import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { getActiveRoomId, purgeExpiredRooms } from "@/lib/games/rooms";

/**
 * UR H.1 当前房间（🔒，断线重连用）。
 * `GET /api/v1/games/rooms/active` —— 200 `{room_id: string|null}`。
 * 无他：iOS 启动／回前台先调本口，有房即回房间（再 GET 状态全量）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const svc = await createServiceClient();
  await purgeExpiredRooms(svc, Date.now());
  const roomId = await getActiveRoomId(svc, userId);
  return apiOk({ room_id: roomId });
}
