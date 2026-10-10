import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseRules } from "@/lib/games/liars";
import {
  appendEvent,
  bumpRoom,
  loadRoomAsMember,
  requireHost,
} from "@/lib/games/rooms";

/**
 * UR H.1 改房规（🔒，仅房主，仅 lobby）。
 * `POST /api/v1/games/rooms/{id}/rules {rules}` —— 200 `{version, rules}`。
 * 房规非法回落默认（parseRules，不 400）；开局后 409 wrong_phase。
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
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  if (loaded.room.status !== "lobby") {
    return apiError("wrong_phase", "開局後不可改房規", 409);
  }
  const rules = parseRules((raw as Record<string, unknown>).rules);
  const { error } = await svc.from("game_rooms").update({ rules }).eq("id", loaded.room.id);
  if (error !== null) {
    console.error(`[games/rules] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "改房規失敗", 500);
  }
  const version = await bumpRoom(svc, loaded.room.id, loaded.room.version, Date.now());
  if (version === null) {
    return apiError("internal", "改房規失敗", 500);
  }
  await appendEvent(svc, loaded.room.id, version, "rules_changed", userId, { rules });
  return apiOk({ version, rules });
}
