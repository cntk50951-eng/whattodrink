/**
 * UR E.32：聊天「分享打卡」列表分頁（`GET /api/v1/checkins/mine/share`）的純邏輯。
 * 新到舊 keyset 分頁（created_at, id）；可分享口徑對齊發送接口的校驗
 * （`conversations/[id]/messages`：本人、主表、非私密、快貼未過期）。
 */
import { parseCompositeCursor } from "./compositeCursor";

export const MINE_SHARE_HEADERS = { "Cache-Control": "private, no-store" };
export const MINE_SHARE_DEFAULT_LIMIT = 20;
export const MINE_SHARE_MAX_LIMIT = 50;
export const MINE_SHARE_QUERY_MAX = 24;

export type MineShareScope = "shareable" | "blocked";
export type MineShareCursor = { createdAt: string; id: string };
export type MineShareParams = {
  scope: MineShareScope;
  limit: number;
  cursor: MineShareCursor | null;
  /** 清洗後的搜索詞；空即 null */
  q: string | null;
};

/**
 * 搜索詞清洗：結果會拼進 PostgREST `or()`（值用雙引號包住），所以去掉引號、反斜線、
 * 分組符與 LIKE 萬用字元；去首尾空白後按字符截到上限。
 */
export function cleanShareQuery(raw: string | null): string | null {
  if (raw === null) return null;
  const stripped = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f"\\,()*%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cut = Array.from(stripped).slice(0, MINE_SHARE_QUERY_MAX).join("").trim();
  return cut === "" ? null : cut;
}

export function parseMineShareParams(search: URLSearchParams): MineShareParams | { error: string } {
  const scopeRaw = search.get("scope") ?? "shareable";
  if (scopeRaw !== "shareable" && scopeRaw !== "blocked") return { error: "scope 非法" };
  const limit = Number(search.get("limit") ?? String(MINE_SHARE_DEFAULT_LIMIT));
  if (!Number.isInteger(limit) || limit < 1 || limit > MINE_SHARE_MAX_LIMIT) {
    return { error: `limit 非法（要 1-${MINE_SHARE_MAX_LIMIT} 整數）` };
  }
  const rawCursor = search.get("cursor");
  const cursor = parseCompositeCursor(rawCursor);
  if (rawCursor !== null && (cursor === null || !Number.isFinite(Date.parse(cursor.createdAt)))) {
    return { error: "cursor 非法" };
  }
  return { scope: scopeRaw, limit, cursor, q: cleanShareQuery(search.get("q")) };
}

/** 可分享：非快貼，或快貼未過期（私密另用 visibility 條件擋） */
export function shareableExpiryFilter(nowIso: string): string {
  return `kind.neq.flash,expires_at.is.null,expires_at.gt.${nowIso}`;
}

/** 主表裡不可分享：私密，或快貼已過期 */
export function blockedLiveFilter(nowIso: string): string {
  return `visibility.eq.private,and(kind.eq.flash,expires_at.lte.${nowIso})`;
}

/** 降序翻頁：比游標舊的行（同一時間戳按 id 繼續） */
export function olderThanFilter(c: MineShareCursor): string {
  return `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`;
}

/** 店名／留言包含搜索詞，或酒款命中。`q` 必須先經 `cleanShareQuery` */
export function shareSearchFilter(q: string, beerIds: readonly string[]): string {
  const parts = [`place_name.ilike."%${q}%"`, `note.ilike."%${q}%"`];
  const ids = beerIds.filter((id) => /^[A-Za-z0-9_-]+$/.test(id));
  if (ids.length > 0) parts.push(`beer_id.in.(${ids.join(",")})`);
  return parts.join(",");
}

/** `created_at` 轉可比較鍵：毫秒之後的微秒另存，免得 JS Date 把同毫秒的行排錯 */
function timeKey(iso: string): [number, number] {
  const m = /^(.*?T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(.*)$/.exec(iso);
  if (m === null) return [0, 0];
  const seconds = Date.parse(`${m[1]}${m[3] === "" ? "Z" : m[3]}`);
  const micros = Number((m[2] ?? "").padEnd(6, "0"));
  return [Number.isFinite(seconds) ? seconds : 0, micros];
}

type Keyed = { id: string; created_at: string };

export function isKeyedRow(v: unknown): v is Keyed & Record<string, unknown> {
  const r = v as { id?: unknown; created_at?: unknown } | null;
  return typeof r === "object" && r !== null && typeof r.id === "string" && typeof r.created_at === "string";
}

/** 新到舊（時間，再按 id） */
export function compareNewestFirst(a: Keyed, b: Keyed): number {
  const [as, au] = timeKey(a.created_at);
  const [bs, bu] = timeKey(b.created_at);
  if (as !== bs) return bs - as;
  if (au !== bu) return bu - au;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * 切一頁。每個來源都要多取一行（limit+1）：合併後超過 limit 就表示還有下一頁。
 * 游標直接用資料行的 `created_at` 原字串（保留微秒）。
 */
export function cutSharePage<T extends Keyed>(rows: readonly T[], limit: number): { page: T[]; nextCursor: string | null } {
  const sorted = [...rows].sort(compareNewestFirst);
  const page = sorted.slice(0, limit);
  const last = page.at(-1);
  return { page, nextCursor: sorted.length > limit && last !== undefined ? `${last.created_at}|${last.id}` : null };
}
