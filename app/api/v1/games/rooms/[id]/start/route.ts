import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseRules, rollDice } from "@/lib/games/liars";
import {
  appendEvent,
  bumpRoom,
  getLatestRound,
  loadRoomAsMember,
  requireHost,
  isStealthUser,
} from "@/lib/games/rooms";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";
import { startSpyRoom } from "@/lib/games/spyRoom";
import { SPY_MAX_PLAYERS, SPY_MIN_PLAYERS } from "@/lib/games/spy";
import { startTrainRoom } from "@/lib/games/trainRoom";
import { startShipoRoom } from "@/lib/games/shipoRoom";
import { SHIPO_MAX_PLAYERS, SHIPO_MIN_PLAYERS } from "@/lib/games/shipo";
import { TRAIN_MAX_PLAYERS, TRAIN_MIN_PLAYERS } from "@/lib/games/train";

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
  if (await isStealthUser(svc, userId)) {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
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
  // UR H.3 誰是臥底：伺服器派詞派身份、排發言順序（4–8 人）；不走骰局流程。
  if (room.game === "spy") {
    if (members.length < SPY_MIN_PLAYERS || members.length > SPY_MAX_PLAYERS) {
      return apiError("invalid_params", `誰是臥底需要 ${SPY_MIN_PLAYERS}–${SPY_MAX_PLAYERS} 人`, 400);
    }
    const started = await startSpyRoom(svc, room, members, userId, Date.now());
    if ("response" in started) return started.response;
    return apiOk({ version: started.version });
  }
  // 老實人·識破：伺服器抽身份與題卡（4–6 人）。
  if (room.game === "shipo") {
    if (members.length < SHIPO_MIN_PLAYERS || members.length > SHIPO_MAX_PLAYERS) {
      return apiError("invalid_params", `識破需要 ${SHIPO_MIN_PLAYERS}–${SHIPO_MAX_PLAYERS} 人`, 400);
    }
    const started = await startShipoRoom(svc, room, members, userId, Date.now());
    if ("response" in started) return started.response;
    return apiOk({ version: started.version });
  }
  // UR H.4 尾班車：伺服器決定隱藏倒數、題目與第一位拿車的人（3–8 人）。
  if (room.game === "last_train") {
    if (members.length < TRAIN_MIN_PLAYERS || members.length > TRAIN_MAX_PLAYERS) {
      return apiError("invalid_params", `尾班車需要 ${TRAIN_MIN_PLAYERS}–${TRAIN_MAX_PLAYERS} 人`, 400);
    }
    const started = await startTrainRoom(svc, room, members, userId, Date.now());
    if ("response" in started) return started.response;
    return apiOk({ version: started.version });
  }
  const rules = parseRules(room.rules);
  const nowMs = Date.now();
  const starter = [...members].sort((a, b) => a.seat - b.seat)[0].user_id;
  const dice: Record<string, number[]> = {};
  for (const m of members) {
    dice[m.user_id] = rollDice(rules.dice_per_player);
  }
  // 局号顺延（回 lobby 重开即新局；写死 no:1 会撞 UNIQUE(room_id,no)）。
  const latest = await getLatestRound(svc, room.id);
  const no = latest !== null ? latest.no + 1 : 1;
  // §九：deal_only 房无轮次无倒计时（current_turn／deadline／last_bid 全 null）。
  const dealOnly = rules.mode === "deal_only";
  const { error: rErr } = await svc.from("game_rounds").insert({
    room_id: room.id,
    no,
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
    no,
    starter_id: starter,
    players: members.map((m) => m.user_id),
  });
  return apiOk({ version });
}
