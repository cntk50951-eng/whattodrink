import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  appendEvent,
  bumpRoom,
  loadRoomAsMember,
  parseReadyBody,
} from "@/lib/games/rooms";

/**
 * UR H.1 准备（🔒）。
 * `POST /api/v1/games/rooms/{id}/ready {ready:bool}` —— 200 `{version, ready}`。
 * 仅 lobby（开局后 409 wrong_phase）；成员 active 才可（门禁见 loadRoomAsMember）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseReadyBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const { room, me } = loaded;
  if (room.status !== "lobby") {
    return apiError("wrong_phase", "對局中不可改準備狀態", 409);
  }
  if (me.ready === parsed.ready) {
    return apiOk({ version: room.version, ready: me.ready });
  }
  const { error } = await svc
    .from("game_room_players")
    .update({ ready: parsed.ready })
    .eq("room_id", room.id)
    .eq("user_id", userId);
  if (error !== null) {
    console.error(`[games/ready] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "準備失敗", 500);
  }
  const version = await bumpRoom(svc, room.id, room.version, Date.now());
  if (version === null) {
    return apiError("internal", "準備失敗", 500);
  }
  await appendEvent(svc, room.id, version, "ready_changed", userId, { ready: parsed.ready });
  return apiOk({ version, ready: parsed.ready });
}
