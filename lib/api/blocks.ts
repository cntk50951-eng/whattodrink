import type { SupabaseClient } from "@supabase/supabase-js";

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

/** 查出與 viewer 存在雙向屏蔽關係的所有對端 user_id（任一方封鎖另一方即互斥）。 */
export async function getBlockedUserIds(
  svc: SupabaseClient,
  viewerId: string | null,
): Promise<Set<string>> {
  if (viewerId === null || viewerId === "") return new Set();
  try {
    const { data, error } = await svc
      .from("cheers_blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)
      .limit(1000);
    if (error !== null || !Array.isArray(data)) return new Set();
    return blockedIdsFromRows(viewerId, data as BlockRow[]);
  } catch {
    return new Set();
  }
}

/** 檢查兩人是否存在雙向屏蔽關係（a 封鎖 b 或 b 封鎖 a）。 */
export async function isPairBlocked(
  svc: SupabaseClient,
  a: string | null,
  b: string | null,
): Promise<boolean> {
  if (a === null || b === null || a === "" || b === "" || a === b) return false;
  try {
    const { data, error } = await svc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
      .limit(1);
    return error === null && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
