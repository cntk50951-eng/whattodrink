import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "./envelope";

type BlockRow = {
  blocker_id?: unknown;
  blocked_id?: unknown;
};

/** 純函數：從雙向 cheers_blocks 行萃取與 viewer 互斥的對端 user_id 集合。 */
export function blockedIdsFromRows(viewerId: string, rows: readonly BlockRow[]): Set<string> {
  const out = new Set<string>();
  if (viewerId === "") return out;
  for (const r of rows) {
    if (r.blocker_id === viewerId && typeof r.blocked_id === "string" && r.blocked_id !== "") {
      out.add(r.blocked_id);
    } else if (r.blocked_id === viewerId && typeof r.blocker_id === "string" && r.blocker_id !== "") {
      out.add(r.blocker_id);
    }
  }
  return out;
}

/**
 * 封鎖關係查不出來（資料庫錯誤／形狀異常）。必須與「沒有封鎖」區分：
 * 以前出錯回空集合／false，地圖、帖文與互動就按「無封鎖」繼續（fail-open，第七輪審核 §3.2）。
 * 路由用 `withBlockGuard` 包起來，統一回可重試的 503。
 */
export class BlockLookupError extends Error {
  constructor(readonly op: string, readonly code: string) {
    super(`block-lookup-failed:${op}:${code}`);
    this.name = "BlockLookupError";
  }
}

const errCode = (e: unknown): string =>
  typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string"
    ? (e as { code: string }).code
    : "unknown";

/** 單次讀取上限；撞頂代表名單可能被截斷，記可觀測錯誤（不丟：丟了等於封鎖多的人全站不可用）。 */
export const BLOCK_READ_LIMIT = 1000;

/** 查出與 viewer 存在雙向屏蔽關係的所有對端 user_id（任一方封鎖另一方即互斥）。查詢失敗拋 `BlockLookupError`。 */
export async function getBlockedUserIds(
  svc: SupabaseClient,
  viewerId: string | null,
): Promise<Set<string>> {
  if (viewerId === null || viewerId === "") return new Set();
  let res: { data: unknown; error: unknown };
  try {
    res = await svc
      .from("cheers_blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)
      .limit(BLOCK_READ_LIMIT);
  } catch (e) {
    throw new BlockLookupError("ids", errCode(e));
  }
  if (res.error !== null && res.error !== undefined) throw new BlockLookupError("ids", errCode(res.error));
  if (!Array.isArray(res.data)) throw new BlockLookupError("ids", "bad-shape");
  if (res.data.length >= BLOCK_READ_LIMIT) {
    console.error(`[api/blocks] block list hit read limit ${BLOCK_READ_LIMIT}; result may be truncated`);
  }
  return blockedIdsFromRows(viewerId, res.data as BlockRow[]);
}

/** 檢查兩人是否存在雙向屏蔽關係（a 封鎖 b 或 b 封鎖 a）。查詢失敗拋 `BlockLookupError`。 */
export async function isPairBlocked(
  svc: SupabaseClient,
  a: string | null,
  b: string | null,
): Promise<boolean> {
  if (a === null || b === null || a === "" || b === "" || a === b) return false;
  let res: { data: unknown; error: unknown };
  try {
    res = await svc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
      .limit(1);
  } catch (e) {
    throw new BlockLookupError("pair", errCode(e));
  }
  if (res.error !== null && res.error !== undefined) throw new BlockLookupError("pair", errCode(res.error));
  if (!Array.isArray(res.data)) throw new BlockLookupError("pair", "bad-shape");
  return res.data.length > 0;
}

/** 封鎖查不出來時給客戶端的統一回包：503 可重試，不洩漏內部錯誤。 */
export function blockLookupUnavailable(): Response {
  return apiError("internal", "暫時未能確認封鎖狀態，請稍後再試", 503, { "Retry-After": "2" });
}

/**
 * 路由處理器外殼：處理器內任何一處 `getBlockedUserIds`／`isPairBlocked` 拋 `BlockLookupError`，
 * 一律回 503（讀寫路徑同一口徑：判定未知就不繼續）。其他錯誤原樣拋出。
 */
export function withBlockGuard<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof BlockLookupError) {
        console.error(`[api/blocks] ${e.message}`);
        return blockLookupUnavailable();
      }
      throw e;
    }
  };
}
