import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { appendEvent, bumpRoom, loadRoomAsMember, requireHost } from "@/lib/games/rooms";

/**
 * UR H.1 结束（🔒，仅房主）。
 * `POST /api/v1/games/rooms/{id}/end` —— 200 `{version}`。
 * 已结束重调回 409 wrong_phase（结算看 batch-3 的 GET）。
 * 行保留 24h 供断线回看结算（purgeExpiredRooms 懒删）。
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
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  const nowIso = new Date().toISOString();
  const { error } = await svc
    .from("game_rooms")
    .update({ status: "ended", ended_at: nowIso })
    .eq("id", loaded.room.id);
  if (error !== null) {
    console.error(`[games/end] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "結束失敗", 500);
  }
  const version = await bumpRoom(svc, loaded.room.id, loaded.room.version, Date.now());
  if (version === null) {
    return apiError("internal", "結束失敗", 500);
  }
  await appendEvent(svc, loaded.room.id, version, "room_ended", userId, { reason: "host" });
  return apiOk({ version });
}
