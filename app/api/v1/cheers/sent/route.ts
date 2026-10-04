import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { friendIdsOf, type FriendshipRow } from "@/lib/friends";

/**
 * UR E.15 送出箱（🔒）。
 * `GET /api/v1/cheers/sent?limit=20` —— from 我倒序 20 行；
 * 每行带对方公开三列＋对方是否回敬（reciprocal）＋是否已是好友（is_friend）＋
 * 对方帖是否还在（checkin_id 悬空即已烧毁）。
 * 状态机由客户端算：已送出／对方回敬了／已成为好友／24h 未回应。
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
    .select("id,to_user_id,checkin_id,created_at,message")
    .eq("from_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error !== null) {
    console.error(`[api/v1/cheers/sent] read error: code=${error.code} message=${error.message}`);
    return apiError("internal", "送出记录读取失败", 500);
  }
  const list = ((rows ?? []) as unknown[]).filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null,
  );
  const toIds = [...new Set(list.map((r) => r.to_user_id).filter((v) => typeof v === "string"))] as string[];
  let peers = new Map<string, { nickname: string; avatar_url: string | null }>();
  let backSet = new Set<string>();
  let friendSet = new Set<string>();
  if (toIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,nickname,avatar_url")
      .in("id", toIds);
    peers = new Map(
      (((users ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null }[]).map(
        (u) => [u.id, { nickname: u.nickname, avatar_url: u.avatar_url }],
      ),
    );
    const { data: backRows } = await supabase
      .from("cheers")
      .select("from_user_id")
      .eq("to_user_id", userId)
      .in("from_user_id", toIds);
    backSet = new Set(
      (((backRows ?? []) as unknown[]) as { from_user_id: string }[]).map((r) => r.from_user_id),
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
  const items = list.map((r) => {
    const toId = r.to_user_id as string;
    const peer = peers.get(toId) ?? { nickname: "酒友", avatar_url: null };
    return {
      id: r.id as string,
      to: { user_id: toId, nickname: peer.nickname, avatar_url: peer.avatar_url },
      checkin_id: (r.checkin_id as string | null) ?? null,
      message: typeof r.message === "string" ? r.message : null,
      created_at: r.created_at as string,
      reciprocal: backSet.has(toId),
      is_friend: friendSet.has(toId),
    };
  });
  return apiOk({ items });
}
