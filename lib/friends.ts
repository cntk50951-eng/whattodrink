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
