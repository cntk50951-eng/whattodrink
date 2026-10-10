import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseRules, rollDice } from "@/lib/games/liars";
import {
  appendEvent,
  bumpRoom,
  loadRoomAsMember,
  requireHost,
} from "@/lib/games/rooms";

/**
 * UR H.1 开始（🔒，仅房主）。
 * `POST /api/v1/games/rooms/{id}/start` —— lobby→playing，开第一局。
 * 门：全员 ready 且 active≥2（400 人话）；playing 重调 409 wrong_phase。
 * 首局 starter＝座位最小 active（输家先叫是次局起，见 batch-3 next_round）。
 * 骰 service 摇（crypto），只进 dice 列（RLS 锁死，客户端只能 batch-3 按人拿）。
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
  const { room, members } = loaded;
  if (room.status !== "lobby") {
    return apiError("wrong_phase", "對局已開始", 409);
  }
  if (members.length < 2) {
    return apiError("invalid_params", "至少 2 人才能開始", 400);
  }
  if (members.some((m) => !m.ready)) {
    return apiError("invalid_params", "有成員未準備", 400);
  }
  const rules = parseRules(room.rules);
  const nowMs = Date.now();
  const starter = [...members].sort((a, b) => a.seat - b.seat)[0].user_id;
  const dice: Record<string, number[]> = {};
  for (const m of members) {
    dice[m.user_id] = rollDice(rules.dice_per_player);
  }
  // §九：deal_only 房无轮次无倒计时（current_turn／deadline／last_bid 全 null）。
  const dealOnly = rules.mode === "deal_only";
  const { error: rErr } = await svc.from("game_rounds").insert({
    room_id: room.id,
    no: 1,
    starter_id: starter,
    status: "bidding",
    dice,
    current_turn_user: dealOnly ? null : starter,
    turn_deadline:
      !dealOnly && rules.turn_seconds > 0
        ? new Date(nowMs + rules.turn_seconds * 1000).toISOString()
        : null,
    last_bid: null,
    bids: [],
  });
  if (rErr !== null) {
    console.error(`[games/start] round error: code=${rErr.code} message=${rErr.message}`);
    return apiError("internal", "開局失敗", 500);
  }
  const { error: sErr } = await svc
    .from("game_rooms")
    .update({ status: "playing" })
    .eq("id", room.id);
  if (sErr !== null) {
    console.error(`[games/start] status error: code=${sErr.code} message=${sErr.message}`);
    return apiError("internal", "開局失敗", 500);
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) {
    return apiError("internal", "開局失敗", 500);
  }
  await appendEvent(svc, room.id, version, "round_started", userId, {
    no: 1,
    starter_id: starter,
    players: members.map((m) => m.user_id),
  });
  return apiOk({ version });
}
