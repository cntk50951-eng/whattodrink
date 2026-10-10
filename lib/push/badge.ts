/**
 * UR D.9 角标口径（与 iOS 红点一致：碰杯未读＋待回应邀约＋聊天未读）。
 * UR B.3 起加收到的好友请求数（incoming pending；交接 §六-1：原先声称含实际无，
 * 本版真正计入，推送 payload 与 counters 同口径）。
 * counters 路由与推送 payload 共用同一函数，口径单点。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** 六数相加（badge＝前五和；game_invites_pending 只展示不计 badge，免打扰，问答定案）。 */
export function sumBadge(cheers: number, invites: number, chat: number, stranger = 0, friendRequests = 0, gameInvites = 0): BadgeCounts {
  const c = Number.isFinite(cheers) && cheers > 0 ? Math.floor(cheers) : 0;
  const i = Number.isFinite(invites) && invites > 0 ? Math.floor(invites) : 0;
  const h = Number.isFinite(chat) && chat > 0 ? Math.floor(chat) : 0;
  const s = Number.isFinite(stranger) && stranger > 0 ? Math.floor(stranger) : 0;
  const f = Number.isFinite(friendRequests) && friendRequests > 0 ? Math.floor(friendRequests) : 0;
  const g = Number.isFinite(gameInvites) && gameInvites > 0 ? Math.floor(gameInvites) : 0;
  return { cheers_unread: c, invites_pending: i, chat_unread: h, stranger_unread: s, friend_requests_pending: f, game_invites_pending: g, badge: c + i + h + s + f };
}

export type BadgeCounts = {
  cheers_unread: number;
  invites_pending: number;
  chat_unread: number;
  /** UR D.10 陌生人未读（badge 含，相加，用户定案）。 */
  stranger_unread: number;
  /** UR B.3 收到的好友请求（incoming pending；badge 含，相加）。 */
  friend_requests_pending: number;
  /** UR H.1 收到的游戏邀请（lobby 房 pending；badge 不含，只展示）。 */
  game_invites_pending: number;
  badge: number;
};

/**
 * UR H.1 游戏邀请数（pending 且房间仍 lobby；表缺席 fail-open 计 0）。
 * 先取我的 pending 行，再看房间是否还在 lobby（playing／ended 即过期）。
 */
export async function countGameInvites(
  supa: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: invRows } = await supa
    .from("game_invites")
    .select("room_id")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .limit(100);
  const roomIds = (
    ((invRows ?? []) as unknown[]) as { room_id?: unknown }[]
  )
    .map((r) => r.room_id)
    .filter((id): id is string => typeof id === "string");
  if (roomIds.length === 0) return 0;
  const { data: rooms } = await supa
    .from("game_rooms")
    .select("id")
    .in("id", roomIds)
    .eq("status", "lobby");
  return ((rooms ?? []) as unknown[]).length;
}

/**
 * 算某人四数（service 或 authed client 皆可；调用方定 RLS 语义）。
 * chat 未读＝我成员行水位之后、非我发的消息数（逐会话，沿 Bell 口径）；
 * 陌生人会话（对端含非好友）单计 stranger_unread。
 */
export async function computeBadge(
  supa: SupabaseClient,
  userId: string,
): Promise<BadgeCounts> {
  const [{ count: cheers }, { count: invites }, { count: friendRequests }, { data: members }] = await Promise.all([
    supa.from("cheers").select("id", { count: "exact", head: true }).eq("to_user_id", userId).is("seen_at", null),
    supa.from("drink_invites").select("id", { count: "exact", head: true }).eq("to_user_id", userId).eq("status", "sent"),
    // UR B.3 收到的好友请求（incoming pending 全量计；表缺席即 fail-open 计 0，见下）。
    supa.from("friendships").select("id", { count: "exact", head: true }).eq("friend_id", userId).eq("status", "pending"),
    supa.from("conversation_members").select("conversation_id,last_read_at").eq("user_id", userId).limit(200),
  ]);
  // UR H.1 收到的游戏邀请（pending 且房间仍 lobby；badge 不含）。
  const { data: fsRows } = await supa
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .limit(500);
  // 好友集（accepted 双向；沿 friendIdsOf 口径内联——vitest 无 @/ 别名，不跨包引）。
  const myFids = new Set<string>();
  for (const r of ((fsRows ?? []) as unknown[]) as {
    user_id: unknown;
    friend_id: unknown;
  }[]) {
    if (typeof r.user_id === "string" && r.user_id !== userId) myFids.add(r.user_id);
    if (typeof r.friend_id === "string" && r.friend_id !== userId) myFids.add(r.friend_id);
  }
  let chat = 0;
  let stranger = 0;
  for (const m of ((members ?? []) as unknown[]) as { conversation_id?: unknown; last_read_at?: unknown }[]) {
    if (typeof m.conversation_id !== "string") continue;
    const water = typeof m.last_read_at === "string" ? m.last_read_at : new Date(0).toISOString();
    const [{ count }, { data: peers }] = await Promise.all([
      supa
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", m.conversation_id)
        .neq("sender_id", userId)
        .gt("created_at", water),
      supa
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", m.conversation_id)
        .neq("user_id", userId)
        .limit(10),
    ]);
    const peerIds = (((peers ?? []) as unknown[]) as { user_id: unknown }[])
      .map((p) => p.user_id)
      .filter((id): id is string => typeof id === "string");
    const isFriend = peerIds.length > 0 && peerIds.every((id) => myFids.has(id));
    if (isFriend) chat += count ?? 0;
    else stranger += count ?? 0;
  }
  return sumBadge(cheers ?? 0, invites ?? 0, chat, stranger, friendRequests ?? 0, await countGameInvites(supa, userId));
}
