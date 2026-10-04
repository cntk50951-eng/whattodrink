import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { friendIdsOf, type FriendshipRow } from "@/lib/friends";

/**
 * UR E.14 被敬收件箱（🔒）。
 * `GET /api/v1/cheers/inbox?limit=20` —— to 我倒序 20 行＋未读数；
 * 只吐敬酒人公开三列＋帖 id＋时间（面板名单＋Bell 计数源）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit =
    limitRaw !== null && Number.isInteger(Number(limitRaw))
      ? Math.min(50, Math.max(1, Number(limitRaw)))
      : 20;
  const { data: rows, error } = await supabase
    .from("cheers")
    .select("id,from_user_id,checkin_id,created_at,seen_at,message")
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error !== null) {
    console.error(`[api/v1/cheers/inbox] read error: code=${error.code} message=${error.message}`);
    return apiError("internal", "乾杯记录读取失败", 500);
  }
  const list = ((rows ?? []) as unknown[]).filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null,
  );
  const fromIds = [...new Set(list.map((r) => r.from_user_id).filter((v) => typeof v === "string"))] as string[];
  let peers = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (fromIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,nickname,avatar_url")
      .in("id", fromIds);
    peers = new Map(
      (((users ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null }[]).map(
        (u) => [u.id, { nickname: u.nickname, avatar_url: u.avatar_url }],
      ),
    );
  }
  const items = list.map((r) => {
    const fromId = r.from_user_id as string;
    const peer = peers.get(fromId) ?? { nickname: "酒友", avatar_url: null };
    return {
      id: r.id as string,
      from: { user_id: fromId, nickname: peer.nickname, avatar_url: peer.avatar_url },
      checkin_id: (r.checkin_id as string | null) ?? null,
      message: typeof r.message === "string" ? r.message : null,
      created_at: r.created_at as string,
      seen: r.seen_at !== null,
    };
  });
  // UR E.15 互敬＋好友态（互敬卡＋撤销入口；批量各一查，不 N+1）。
  const peerIds = [...new Set(items.map((i) => i.from.user_id))];
  let backSet = new Set<string>();
  let friendSet = new Set<string>();
  if (peerIds.length > 0) {
    const { data: backRows } = await supabase
      .from("cheers")
      .select("to_user_id")
      .eq("from_user_id", userId)
      .in("to_user_id", peerIds);
    backSet = new Set(
      (((backRows ?? []) as unknown[]) as { to_user_id: string }[]).map((r) => r.to_user_id),
    );
    const { data: fsRows } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .limit(200);
    const frows = ((fsRows ?? []) as unknown[]).filter(
      (r): r is FriendshipRow =>
        typeof r === "object" && r !== null && "user_id" in (r as Record<string, unknown>),
    );
    friendSet = new Set(friendIdsOf(userId, frows));
  }
  const enriched = items.map((i) => ({
    ...i,
    mutual: backSet.has(i.from.user_id),
    is_friend: friendSet.has(i.from.user_id),
  }));
  const { count: unread } = await supabase
    .from("cheers")
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", userId)
    .is("seen_at", null);
  return apiOk({ unread: unread ?? 0, items: enriched });
}
