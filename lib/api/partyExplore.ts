/**
 * UR E.34 酒局「探索」分頁（純函數）：參數解析、頁面切割、已結束局的可見範圍。
 * 默認的 `GET /parties` 不走這裡；只有 `view=explore` 才用。
 */
import { parseCompositeCursor } from "./compositeCursor";

export const EXPLORE_PHASES = ["active", "ended"] as const;
export type ExplorePhase = (typeof EXPLORE_PHASES)[number];

export type ExploreParams = {
  phase: ExplorePhase;
  /** `start_at` 窗口 [from, to)；客戶端按香港日界算好 */
  from: string | null;
  to: string | null;
  /** keyset：上一頁最後一行的 start_at 與 id */
  cursor: { startAt: string; id: string } | null;
};

/** 沒帶 `view=explore` 回 null（走原有默認邏輯）；帶了但參數不合法回 `{error}`。 */
export function parseExploreParams(q: URLSearchParams): ExploreParams | { error: string } | null {
  if (q.get("view") !== "explore") return null;
  const phase = q.get("phase");
  if (phase !== "active" && phase !== "ended") return { error: "phase 只要 active|ended" };
  const bounds: { from: string | null; to: string | null } = { from: null, to: null };
  for (const key of ["from", "to"] as const) {
    const raw = q.get(key);
    if (raw === null || raw === "") continue;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return { error: `${key} 非法` };
    bounds[key] = new Date(ms).toISOString();
  }
  if (bounds.from !== null && bounds.to !== null && bounds.from >= bounds.to) return { error: "from 需早於 to" };
  const rawCursor = q.get("cursor");
  let cursor: ExploreParams["cursor"] = null;
  if (rawCursor !== null && rawCursor !== "") {
    // 同一套複合游標校驗（時間戳字符集＋UUID），這裡時間欄是 start_at
    const parsed = parseCompositeCursor(rawCursor);
    if (parsed === null) return { error: "cursor 非法" };
    cursor = { startAt: parsed.createdAt, id: parsed.id };
  }
  return { phase, ...bounds, cursor };
}

/** keyset 條件（PostgREST `or`）：進行中往後翻、已結束往前翻。 */
export function exploreCursorFilter(phase: ExplorePhase, cursor: { startAt: string; id: string }): string {
  const op = phase === "active" ? "gt" : "lt";
  return `start_at.${op}.${cursor.startAt},and(start_at.eq.${cursor.startAt},id.${op}.${cursor.id})`;
}

type ExploreRow = { id: string; host_user_id: string; start_at: string };

/** 排除名單不超過這個數就拼進 SQL（頁面保持滿）；超過就多讀再濾。 */
export const EXPLORE_SQL_EXCLUDE_LIMIT = 200;
const EXPLORE_OVERFETCH_CAP = 500;

/** 這次要向資料庫讀幾行（多讀 1 行用來判斷還有沒有下一頁）。 */
export function exploreFetchLimit(limit: number, filterInMemory: number): number {
  return Math.min(limit + 1 + filterInMemory, EXPLORE_OVERFETCH_CAP);
}

/**
 * 把讀回的行切成一頁。`excluded` 只放沒拼進 SQL 的名單。
 * 還有下一頁時回 `next_cursor`；整批被濾掉但資料庫還有行時，游標落在讀到的最後一行，客戶端能繼續翻。
 */
export function explorePage<T extends ExploreRow>(
  rows: T[],
  args: { limit: number; fetchLimit: number; excludedHosts: Set<string>; excludedParties: Set<string> },
): { list: T[]; next_cursor: string | null } {
  const kept = rows.filter((r) => !args.excludedHosts.has(r.host_user_id) && !args.excludedParties.has(r.id));
  const list = kept.slice(0, args.limit);
  const at = (r: T | undefined): string | null => (r === undefined ? null : `${r.start_at}|${r.id}`);
  if (kept.length > args.limit) return { list, next_cursor: at(list[list.length - 1]) };
  if (rows.length >= args.fetchLimit) return { list, next_cursor: at(rows[rows.length - 1]) };
  return { list, next_cursor: null };
}

export type PartyMemberAccess = "all" | "host_only" | "login";

/**
 * 局詳情的成員可見範圍。只收緊「正常結束」的局（status open 且已過期）：
 * 未登入要先登入；不是發起人／參加者只看得到發起人和人數。未結束、已撤銷的局沿舊行為。
 */
export function partyMemberAccess(args: {
  status: string;
  expiresAtMs: number;
  viewerId: string | null;
  isMember: boolean;
  nowMs: number;
}): PartyMemberAccess {
  const ended = args.status === "open" && Number.isFinite(args.expiresAtMs) && args.expiresAtMs <= args.nowMs;
  if (!ended) return "all";
  if (args.viewerId === null) return "login";
  return args.isMember ? "all" : "host_only";
}
