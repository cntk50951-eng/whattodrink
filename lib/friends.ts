/**
 * UR A.17 好友模式 — 好友關係純函數（可單測）。
 * 好友＝`friendships` 任一方向 `status='accepted'` 即互為好友（沿 A.15 D3）；
 * `pending`／`blocked`／自查一律不算。A.19 引導浮層復用同一函數。
 */

export type FriendshipRow = {
  user_id: unknown;
  friend_id: unknown;
  status: unknown;
};

/** 任一方向 accepted 即互為好友（自查永遠 false）。 */
export function areFriends(
  me: string,
  other: string,
  rows: FriendshipRow[],
): boolean {
  if (me === other) return false;
  for (const r of rows) {
    if (r.status !== "accepted") continue;
    if (
      (r.user_id === me && r.friend_id === other) ||
      (r.user_id === other && r.friend_id === me)
    ) {
      return true;
    }
  }
  return false;
}

/** 我的好友 id 集（accepted 雙向去重；A.19／pins scope 共用）。 */
export function friendIdsOf(me: string, rows: FriendshipRow[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.status !== "accepted") continue;
    if (r.user_id === me && typeof r.friend_id === "string") {
      out.add(r.friend_id);
    } else if (r.friend_id === me && typeof r.user_id === "string") {
      out.add(r.user_id);
    }
  }
  out.delete(me);
  return [...out];
}

export function parseCheckUserId(
  search: URLSearchParams,
): { userId: string } | { error: string } {
  const raw = search.get("user_id");
  if (raw === null || raw.trim() === "") {
    return { error: "user_id 必填" };
  }
  const v = raw.trim();
  if (v.length > 64) {
    return { error: "user_id 非法" };
  }
  return { userId: v };
}

/**
 * UR A.19 引導浮層好友感知：`user_id` 與 `checkin_id` 二選一互斥
 * （調用方手裡只有 checkin id 時走後者，server 側解作者，零新增暴露）。
 */
export type FriendCheckTarget = { userId: string } | { checkinId: string };

export function parseFriendCheckParams(
  search: URLSearchParams,
): { target: FriendCheckTarget } | { error: string } {
  const userRaw = search.get("user_id");
  const checkRaw = search.get("checkin_id");
  const hasUser = userRaw !== null && userRaw.trim() !== "";
  const hasCheck = checkRaw !== null && checkRaw.trim() !== "";
  if (hasUser && hasCheck) {
    return { error: "user_id 與 checkin_id 二選一，不可並存" };
  }
  if (hasUser) {
    const v = (userRaw as string).trim();
    if (v.length > 64) return { error: "user_id 非法" };
    return { target: { userId: v } };
  }
  if (hasCheck) {
    const v = (checkRaw as string).trim();
    if (v.length > 64) return { error: "checkin_id 非法" };
    return { target: { checkinId: v } };
  }
  return { error: "user_id 或 checkin_id 必填其一" };
}

export const PINS_SCOPES = ["all", "friends"] as const;
export type PinsScope = (typeof PINS_SCOPES)[number];
export const PINS_SCOPE_DEFAULT = "all" as const;

export function parseScope(raw: string | null): { scope: PinsScope } | { error: string } {
  const v = raw === null || raw.trim() === "" ? PINS_SCOPE_DEFAULT : raw.trim();
  if ((PINS_SCOPES as readonly string[]).includes(v)) {
    return { scope: v as PinsScope };
  }
  return { error: `scope 非法：${raw ?? ""}（只要 all|friends）` };
}

/**
 * DEF-20260926-009＋UR A.19：加好友請求體（`friend_id` 與 `checkin_id`
 * 二選一，後者 server 解作者；沿 check 端口徑）。
 */
export type AddFriendBody = { friendId: string } | { checkinId: string };

export function parseAddFriendBody(
  raw: unknown,
): { body: AddFriendBody } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "body 需为对象" };
  }
  const r = raw as Record<string, unknown>;
  const fRaw = r.friend_id;
  const cRaw = r.checkin_id;
  const hasF = typeof fRaw === "string" && fRaw.trim() !== "";
  const hasC = typeof cRaw === "string" && cRaw.trim() !== "";
  if (hasF && hasC) {
    return { error: "friend_id 與 checkin_id 二選一，不可並存" };
  }
  if (hasF) {
    const v = (fRaw as string).trim();
    if (v.length > 64) return { error: "friend_id 非法" };
    return { body: { friendId: v } };
  }
  if (hasC) {
    const v = (cRaw as string).trim();
    if (v.length > 64) return { error: "checkin_id 非法" };
    return { body: { checkinId: v } };
  }
  return { error: "friend_id 或 checkin_id 必填其一" };
}

/**
 * 綠點關係過濾（A.15 D4）：friends 模式作者只給好友看在線。
 * authorMode 未知（舊行／匿名源）按 public 沿舊行為。
 */
export function hideOnlineForViewer(
  authorMode: string | null,
  authorId: string | null,
  viewerId: string | null,
  friendIds: string[],
): boolean {
  if (authorMode !== "friends") return false;
  if (authorId === null) return false;
  if (viewerId !== null && viewerId === authorId) return false;
  return !friendIds.includes(authorId);
}
