/**
 * UR D.9 角标口径（与 iOS 红点一致：碰杯未读＋待回应邀约＋聊天未读）。
 * counters 路由与推送 payload 共用同一函数，口径单点。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** 三数相加（badge＝和；纯加法，单测锁口径）。 */
export function sumBadge(cheers: number, invites: number, chat: number): BadgeCounts {
  const c = Number.isFinite(cheers) && cheers > 0 ? Math.floor(cheers) : 0;
  const i = Number.isFinite(invites) && invites > 0 ? Math.floor(invites) : 0;
  const h = Number.isFinite(chat) && chat > 0 ? Math.floor(chat) : 0;
  return { cheers_unread: c, invites_pending: i, chat_unread: h, badge: c + i + h };
}

export type BadgeCounts = {
  cheers_unread: number;
  invites_pending: number;
  chat_unread: number;
  badge: number;
};

/**
 * 算某人三数（service 或 authed client 皆可；调用方定 RLS 语义）。
 * chat 未读＝我成员行水位之后、非我发的消息数（逐会话，沿 Bell 口径）。
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
  let chat = 0;
  for (const m of ((members ?? []) as unknown[]) as { conversation_id?: unknown; last_read_at?: unknown }[]) {
    if (typeof m.conversation_id !== "string") continue;
    const water = typeof m.last_read_at === "string" ? m.last_read_at : new Date(0).toISOString();
    const { count } = await supa
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", m.conversation_id)
      .neq("sender_id", userId)
      .gt("created_at", water);
    chat += count ?? 0;
  }
  return sumBadge(cheers ?? 0, invites ?? 0, chat);
}
