import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { generateRoomCode } from "@/lib/games/liars";
import {
  ROOM_CREATE_HOURLY_LIMIT,
  ROOM_TTL_MS,
  appendEvent,
  getActiveRoomId,
  parseCreateBody,
  purgeExpiredRooms,
  toRoomJson,
} from "@/lib/games/rooms";

/**
 * UR H.1 建房（🔒，POC）。
 * `POST /api/v1/games/rooms {game?, max_players?, rules?}` —— 201 `{room}`。
 * 门：18+（403 age_restricted）／同时 1 房（409 already_in_room 带 room_id）／
 * 小时 10 房（429）。房主 ready=false（与成员同口径，开始要全员 ready）。
 * 写走 service（game_* RLS 零 policy 锁死，沿 0042）。
 */
export async function POST(req: Request): Promise<Response> {
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
  const parsed = parseCreateBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  await purgeExpiredRooms(svc, nowMs);
  const { data: meRow } = await svc.from("users").select("dob").eq("id", userId).maybeSingle();
  if (isMinorDob((meRow as { dob?: unknown } | null)?.dob, nowMs)) {
    return apiError("age_restricted", "未滿 18 歲不可玩酒桌遊戲", 403);
  }
  const hourAgo = new Date(nowMs - 3600_000).toISOString();
  const { count: hourCount } = await svc
    .from("game_rooms")
    .select("id", { count: "exact", head: true })
    .eq("host_id", userId)
    .gte("created_at", hourAgo);
  if ((hourCount ?? 0) >= ROOM_CREATE_HOURLY_LIMIT) {
    return apiError("rate_limited", "建房太頻繁，稍後再試", 429);
  }
  const existing = await getActiveRoomId(svc, userId);
  if (existing !== null) {
    // 包络无 error 带数通道；iOS 拿 409 后调 GET /active 即回房间（交接 §3.1 的 room_id 即此）。
    return apiError("already_in_room", "你已在一個房間裡", 409);
  }
  // 房間碼碰撞重試（partial unique 背書；5 次撞即 500，概率可忽略）。
  let roomRaw: unknown = null;
  for (let t = 0; t < 5 && roomRaw === null; t += 1) {
    const { data, error } = await svc
      .from("game_rooms")
      .insert({
        code: generateRoomCode(),
        game: parsed.game,
        host_id: userId,
        status: "lobby",
        rules: parsed.rules,
        max_players: parsed.maxPlayers,
        version: 1,
        expires_at: new Date(nowMs + ROOM_TTL_MS).toISOString(),
      })
      .select("id,code,game,host_id,status,rules,max_players,version,expires_at,ended_at")
      .single();
    if (error === null) {
      roomRaw = data;
    } else if (error.code !== "23505") {
      console.error(`[games/rooms] create error: code=${error.code} message=${error.message}`);
      return apiError("internal", "建房失敗", 500);
    }
  }
  if (roomRaw === null) {
    return apiError("internal", "建房失敗", 500);
  }
  const room = toRoomJson(roomRaw);
  if (room === null) {
    return apiError("internal", "建房失敗", 500);
  }
  const { error: pErr } = await svc.from("game_room_players").insert({
    room_id: room.id,
    user_id: userId,
    seat: 0,
    ready: false,
    status: "active",
  });
  if (pErr !== null) {
    console.error(`[games/rooms] seat error: code=${pErr.code} message=${pErr.message}`);
    await svc.from("game_rooms").delete().eq("id", room.id);
    return apiError("internal", "建房失敗", 500);
  }
  await appendEvent(svc, room.id, 1, "room_created", userId, {
    code: room.code,
    max_players: room.max_players,
  });
  return apiOk({ room }, 201);
}
