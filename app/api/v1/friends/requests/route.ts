import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

type FsRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  origin: string | null;
  source_checkin_id: string | null;
  created_at: string;
};

/**
 * UR B.3 请求列表（🔒）。
 * `GET /api/v1/friends/requests?box=incoming|outgoing` —— incoming 缺省；
 * incoming＝别人加我的 pending；outgoing＝我发出的 pending；
 * 富行（对方公开三列＋性别＋origin＋来源帖＋时间）＋顶层 pending（收到的总数）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const q = new URL(req.url).searchParams;
  const boxRaw = (q.get("box") ?? "incoming").trim();
  if (boxRaw !== "incoming" && boxRaw !== "outgoing") {
    return apiError("invalid_params", "box 只要 incoming|outgoing", 400);
  }
  const { data, error } = await supabase
    .from("friendships")
    .select("id,user_id,friend_id,status,origin,source_checkin_id,created_at")
    .eq("status", "pending")
    .eq(boxRaw === "incoming" ? "friend_id" : "user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error !== null) {
    console.error(`[api/v1/friends/requests] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "请求读取失败", 500);
  }
  const rows = ((data ?? []) as unknown[]) as FsRow[];
  const peerIds = [...new Set(rows.map((r) => (boxRaw === "incoming" ? r.user_id : r.friend_id)))];
  const userById = new Map<string, { nickname: string; avatar_url: string | null; gender: string | null }>();
  const postById = new Map<string, { place_name: string | null; photo_thumb: string | null }>();
  if (peerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,nickname,avatar_url,gender")
      .in("id", peerIds);
    for (const u of ((users ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof u.id !== "string") continue;
      userById.set(u.id, {
        nickname: typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友",
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
        gender: typeof u.gender === "string" ? u.gender : null,
      });
    }
  }
  const postIds = [...new Set(rows.map((r) => r.source_checkin_id).filter((id): id is string => typeof id === "string" && id !== ""))];
  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from("checkins")
      .select("id,place_name,photo_thumb")
      .in("id", postIds);
    for (const p of ((posts ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof p.id !== "string") continue;
      postById.set(p.id, {
        place_name: typeof p.place_name === "string" ? p.place_name : null,
        photo_thumb: typeof p.photo_thumb === "string" ? p.photo_thumb : null,
      });
    }
  }
  const items = rows.map((r) => {
    const peerId = boxRaw === "incoming" ? r.user_id : r.friend_id;
    const peer = userById.get(peerId) ?? { nickname: "酒友", avatar_url: null, gender: null };
    const post = r.source_checkin_id !== null ? (postById.get(r.source_checkin_id) ?? null) : null;
    return {
      id: r.id,
      user: { user_id: peerId, nickname: peer.nickname, avatar_url: peer.avatar_url, gender: peer.gender },
      status: "pending" as const,
      created_at: r.created_at,
      origin: r.origin ?? "direct",
      source_checkin:
        post === null
          ? null
          : { id: r.source_checkin_id as string, place_name: post.place_name, thumb_url: post.photo_thumb },
    };
  });
  // pending 总数＝iOS 铃铛数（incoming 全量计；列表截 100，数另计准）。
  const { count } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("friend_id", userId);
  return apiOk({ items, pending: count ?? items.filter(() => boxRaw === "incoming").length });
}
