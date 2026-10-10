import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { applyDeparture, loadRoomAsMember } from "@/lib/games/rooms";

/**
 * UR H.1 离开（🔒）。
 * `POST /api/v1/games/rooms/{id}/leave` —— 200 `{version}`。
 * 房主走→座位最小接任；无人／局中剩 <2 人→ended；轮到离场者→顺延（见 applyDeparture）。
 */
export async function POST(
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
  const { error } = await svc
    .from("game_room_players")
    .update({ status: "left" })
    .eq("room_id", loaded.room.id)
    .eq("user_id", userId);
  if (error !== null) {
    console.error(`[games/leave] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "離開失敗", 500);
  }
  const done = await applyDeparture(svc, loaded, userId, "member_left", userId, Date.now());
  if ("response" in done) return done.response;
  return apiOk({ version: done.version });
}
