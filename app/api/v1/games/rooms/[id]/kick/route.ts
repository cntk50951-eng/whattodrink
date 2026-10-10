import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  applyDeparture,
  loadRoomAsMember,
  parseKickBody,
  requireHost,
} from "@/lib/games/rooms";

/**
 * UR H.1 踢人（🔒，仅房主）。
 * `POST /api/v1/games/rooms/{id}/kick {user_id}` —— 200 `{version}`。
 * 不可踢自己／房主（房主想走用 leave）；被踢者 status=kicked，重进码 403。
 * 局中善后与 leave 同（applyDeparture）。
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
  const parsed = parseKickBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  if (parsed.userId === userId) {
    return apiError("invalid_params", "不可踢自己（想走用離開）", 400);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  if (!loaded.members.some((m) => m.user_id === parsed.userId)) {
    return apiError("not_found", "該成員不在房間", 404);
  }
  const { error } = await svc
    .from("game_room_players")
    .update({ status: "kicked" })
    .eq("room_id", loaded.room.id)
    .eq("user_id", parsed.userId);
  if (error !== null) {
    console.error(`[games/kick] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "踢人失敗", 500);
  }
  const done = await applyDeparture(svc, loaded, parsed.userId, "member_kicked", userId, Date.now());
  if ("response" in done) return done.response;
  return apiOk({ version: done.version });
}
