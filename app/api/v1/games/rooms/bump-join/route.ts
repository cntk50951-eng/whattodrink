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
  isGameBanned,
  isStealthUser,
  purgeExpiredRooms,
  toRoomJson,
} from "@/lib/games/rooms";
import { parseBumpBody, verifyBumpToken } from "@/lib/games/bump";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";

/**
 * 蓝牙碰一碰加入（需登录）。
 * `POST /api/v1/games/rooms/bump-join {token}` —— 200 `{room_id, nickname, count, max}`。
 * 与输码加入同一组门（18+／禁玩／同时 1 房／lobby／被踢／满员／拉黑解友），
 * 唯一差别：凭证有效（只能贴近房主手机经 BLE 读到）即直接入座，不看好友／同酒局，不走房主审批。
 * 凭证 60 秒过期；每人每分钟 20 次。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  if (!ipRateLimit(`game-bump-join:${userId}`, Date.now(), 60_000, 20).ok) {
    return apiError("rate_limited", "嘗試太頻繁，稍後再試", 429);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseBumpBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const nowMs = Date.now();
  const check = verifyBumpToken(parsed.token, nowMs);
  if (!check.ok) {
    if (check.reason === "unavailable") return apiError("internal", "暫時未能使用碰一碰", 503);
    if (check.reason === "expired") return apiError("invalid_params", "碰一碰已過期，再碰一次", 400);
    return apiError("invalid_params", "碰一碰憑證不合法", 400);
  }
  const svc = await createServiceClient();
  if (await isStealthUser(svc, userId)) {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
  await purgeExpiredRooms(svc, nowMs);
  const { data: meRow } = await svc.from("users").select("dob").eq("id", userId).maybeSingle();
  if (isMinorDob((meRow as { dob?: unknown } | null)?.dob, nowMs)) {
    return apiError("age_restricted", "未滿 18 歲不可玩酒桌遊戲", 403);
  }
  if (await isGameBanned(svc, userId, nowMs)) {
    return apiError("game_banned", "你暫時不可玩酒桌遊戲", 403);
  }
  const { data: roomRaw } = await svc
    .from("game_rooms")
    .select("id,code,game,host_id,status,rules,max_players,version,expires_at,ended_at")
    .eq("id", check.roomId)
    .neq("status", "ended")
    .maybeSingle();
  const room = toRoomJson(roomRaw);
  if (room === null) {
    return apiError("room_not_found", "房間不存在或已結束", 404);
  }
  const mine = await getPlayerRow(svc, room.id, userId);
  const members = await getActiveMembers(svc, room.id);
  const hostNick = await nicknameOf(svc, room.host_id);
  const summary = { room_id: room.id, nickname: hostNick, count: members.length, max: room.max_players };
  if (mine !== null && mine.status === "active") {
    return apiOk(summary);
  }
  const existing = await getActiveRoomId(svc, userId);
  if (existing !== null) {
    return apiError("already_in_room", "你已在一個房間裡", 409);
  }
  if (room.status !== "lobby") {
    return apiError("room_started", "對局已開始，不可再加入", 409);
  }
  if (mine !== null && mine.status === "kicked") {
    return apiError("not_allowed", "你曾被請出該房間", 403);
  }
  if (members.length >= room.max_players) {
    return apiError("room_full", "房間已滿", 409);
  }
  for (const m of members) {
    if (await hasBlockOrMute(svc, userId, m.user_id)) {
      return apiError("not_allowed", "你暫時不可加入該房間", 403);
    }
  }
  const seat = members.reduce((mx, m) => Math.max(mx, m.seat), -1) + 1;
  if (mine !== null && mine.status === "left") {
    const { error: rErr } = await svc
      .from("game_room_players")
      .update({ status: "active", seat, ready: false, last_seen_at: new Date(nowMs).toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", userId);
    if (rErr !== null) {
      console.error(`[games/bump-join] rejoin error: code=${rErr.code} message=${rErr.message}`);
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
      console.error(`[games/bump-join] join error: code=${jErr.code} message=${jErr.message}`);
      return apiError("internal", "加入失敗", 500);
    }
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version !== null) {
    await appendEvent(svc, room.id, version, "member_joined", userId, { seat, via: "bump" });
  }
  return apiOk({ ...summary, count: members.length + 1 });
}

async function nicknameOf(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
): Promise<string> {
  const { data } = await svc.from("users").select("nickname").eq("id", userId).maybeSingle();
  const n = (data as { nickname?: unknown } | null)?.nickname;
  return typeof n === "string" && n !== "" ? n : "酒友";
}
