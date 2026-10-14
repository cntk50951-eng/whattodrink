import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { expireJoinRequests, loadRoomAsMember, requireHost } from "@/lib/games/rooms";

/**
 * UR H.2 入房申请列表（🔒，仅房主）。
 * `GET /api/v1/games/rooms/:id/requests` —— pending 申请（过期先清）。
 * 只回 request_id＋对方昵称头像＋时间（§6：不回好友关系／性别／年龄／位置）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  await expireJoinRequests(svc, loaded.room.id, Date.now());
  const { data: rows, error } = await svc
    .from("game_join_requests")
    .select("id,user_id,created_at")
    .eq("room_id", loaded.room.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error !== null) {
    console.error(`[games/requests] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "读取失败", 500);
  }
  const list = ((rows ?? []) as unknown[]) as { id: string; user_id: string; created_at: string }[];
  const uids = [...new Set(list.map((r) => r.user_id))];
  const userById = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (uids.length > 0) {
    const { data: users } = await svc.from("users").select("id,nickname,avatar_url").in("id", uids);
    for (const u of ((users ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof u.id !== "string") continue;
      userById.set(u.id, {
        nickname: typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友",
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
      });
    }
  }
  return apiOk({
    items: list.map((r) => {
      const u = userById.get(r.user_id) ?? { nickname: "酒友", avatar_url: null };
      return {
        request_id: r.id,
        user: { id: r.user_id, nickname: u.nickname, avatar_url: u.avatar_url },
        created_at: r.created_at,
        expires_at: new Date(Date.parse(r.created_at) + 5 * 60_000).toISOString(),
      };
    }),
  });
}
