/**
 * UR D.9 角标口径（与 iOS 红点一致：碰杯未读＋待回应邀约＋聊天未读）。
 * counters 路由与推送 payload 共用同一函数，口径单点。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** 三数相加（badge＝和；纯加法，单测锁口径）。 */
export function sumBadge(cheers: number, invites: number, chat: number, stranger = 0): BadgeCounts {
  const c = Number.isFinite(cheers) && cheers > 0 ? Math.floor(cheers) : 0;
  const i = Number.isFinite(invites) && invites > 0 ? Math.floor(invites) : 0;
  const h = Number.isFinite(chat) && chat > 0 ? Math.floor(chat) : 0;
  const s = Number.isFinite(stranger) && stranger > 0 ? Math.floor(stranger) : 0;
  return { cheers_unread: c, invites_pending: i, chat_unread: h, stranger_unread: s, badge: c + i + h + s };
}

export type BadgeCounts = {
  cheers_unread: number;
  invites_pending: number;
  chat_unread: number;
  /** UR D.10 陌生人未读（badge 含，相加，用户定案）。 */
  stranger_unread: number;
  badge: number;
};

/**
 * 算某人四数（service 或 authed client 皆可；调用方定 RLS 语义）。
 * chat 未读＝我成员行水位之后、非我发的消息数（逐会话，沿 Bell 口径）；
 * 陌生人会话（对端含非好友）单计 stranger_unread。
 */
export async function computeBadge(
  supa: SupabaseClient,
  userId: string,
): Promise<BadgeCounts> {
  const [{ count: cheers }, { count: invites }, { data: members }] = await Promise.all([
    supa.from("cheers").select("id", { count: "exact", head: true }).eq("to_user_id", userId).is("seen_at", null),
    supa.from("drink_invites").select("id", { count: "exact", head: true }).eq("to_user_id", userId).eq("status", "sent"),
    supa.from("conversation_members").select("conversation_id,last_read_at").eq("user_id", userId).limit(200),
  ]);
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
  return sumBadge(cheers ?? 0, invites ?? 0, chat, stranger);
}
