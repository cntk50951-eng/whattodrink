import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { ipRateLimit } from "@/lib/rateLimit";
import {
  appendEvent,
  bumpRoom,
  getActiveMembers,
  getActiveRoomId,
  getPlayerRow,
  hasBlockOrMute,
  isFriend,
  parseJoinCode,
  purgeExpiredRooms,
  sharesActiveParty,
  toRoomJson,
} from "@/lib/games/rooms";

/**
 * UR H.1 输码加入（🔒，POC）。
 * `POST /api/v1/games/rooms/join {code}` —— 200 `{room_id}`。
 * 门（按序）：码限频 10/min（429）／18+（403）／同时 1 房（409＋调 active 回去）／
 * 房存在活跃（404 不泄）／lobby（已开局 409 room_started）／曾被踢（403）／
 * 满员（409）／与任一在场成员无拉黑解友（403）／与房主好友或同酒局（403）。
 * 重进（left→active）与本房重复加入（200 幂等）都處理。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  if (!ipRateLimit(`game-join:${userId}`, Date.now(), 60_000, 10).ok) {
    return apiError("rate_limited", "嘗試太頻繁，稍後再試", 429);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseJoinCode(raw);
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
  const existing = await getActiveRoomId(svc, userId);
  if (existing !== null) {
    return apiError("already_in_room", "你已在一個房間裡", 409);
  }
  const { data: roomRaw } = await svc
    .from("game_rooms")
    .select("id,code,game,host_id,status,rules,max_players,version,expires_at,ended_at")
    .eq("code", parsed.code)
    .neq("status", "ended")
    .maybeSingle();
  const room = toRoomJson(roomRaw);
  if (room === null) {
    return apiError("room_not_found", "房間不存在或已結束", 404);
  }
  if (room.status !== "lobby") {
    return apiError("room_started", "對局已開始，不可再加入", 409);
  }
  const mine = await getPlayerRow(svc, room.id, userId);
  if (mine !== null && mine.status === "active") {
    return apiOk({ room_id: room.id });
  }
  if (mine !== null && mine.status === "kicked") {
    return apiError("not_allowed", "你曾被請出該房間", 403);
  }
  const members = await getActiveMembers(svc, room.id);
  if (members.length >= room.max_players) {
    return apiError("room_full", "房間已滿", 409);
  }
  // 拉黑／解友任一方（与在场任一成员，双表；沿 B.3＋交接 §六）。
  for (const m of members) {
    if (await hasBlockOrMute(svc, userId, m.user_id)) {
      return apiError("not_allowed", "你暫時不可加入該房間", 403);
    }
  }
  // 好友或同酒局（只认房主——信任锚；问答定案 joins 交集）。
  const friend = await isFriend(svc, userId, room.host_id);
  const party = friend ? false : await sharesActiveParty(svc, userId, room.host_id, nowMs);
  if (!friend && !party) {
    return apiError("not_allowed", "只限好友或同酒局成員", 403);
  }
  const seat = members.reduce((mx, m) => Math.max(mx, m.seat), -1) + 1;
  if (mine !== null && mine.status === "left") {
    const { error: rErr } = await svc
      .from("game_room_players")
      .update({ status: "active", seat, ready: false, last_seen_at: new Date(nowMs).toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", userId);
    if (rErr !== null) {
      console.error(`[games/join] rejoin error: code=${rErr.code} message=${rErr.message}`);
      return apiError("internal", "加入失敗", 500);
    }
  } else {
    const { error: jErr } = await svc.from("game_room_players").insert({
      room_id: room.id,
      user_id: userId,
      seat,
      ready: false,
      status: "active",
    });
    if (jErr !== null) {
      console.error(`[games/join] join error: code=${jErr.code} message=${jErr.message}`);
      return apiError("internal", "加入失敗", 500);
    }
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version !== null) {
    await appendEvent(svc, room.id, version, "member_joined", userId, { seat });
  }
  return apiOk({ room_id: room.id });
}
