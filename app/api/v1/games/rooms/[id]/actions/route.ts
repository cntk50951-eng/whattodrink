import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { ipRateLimit } from "@/lib/rateLimit";
import { isValidBid, parseRules } from "@/lib/games/liars";
import {
  applyBid,
  applyChallenge,
  applyReveal,
  appendEvent,
  bumpRoom,
  getActiveMembers,
  getEventsSince,
  getLatestRound,
  loadRoomAsMember,
  parseActionBody,
  settleRoom,
  startNextRound,
} from "@/lib/games/rooms";

/**
 * UR H.1 动作（🔒）。
 * `POST /api/v1/games/rooms/{id}/actions {type, payload, expected_version, client_action_id}`
 * —— 200 `{version, events}`（events＝expected 之后的新事件；iOS 或直接用或再 GET）。
 * - 幂等：同房同 client_action_id 重发回首次结果（`replayed:true`），防双击／重试。
 *   幂等先行——重试带旧 version 不判 409。
 * - expected 落后→409 stale_version（iOS 重拉，不重试）。
 * - bid／challenge 须轮到我（409 not_your_turn）且 bidding 中（409 wrong_phase）；
 *   bid 规则错→422 invalid_bid（reason 进 message）；next_round 须 revealed 后任何人。
 * - 限流 5/s（429）。每次写前先懒超时结算。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  if (!ipRateLimit(`game-act:${userId}`, Date.now(), 1000, 5).ok) {
    return apiError("rate_limited", "操作太快，稍後再試", 429);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseActionBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  let room = loaded.room;
  if (room.status !== "playing") {
    return apiError("wrong_phase", "對局未開始", 409);
  }
  // 幂等先行（重发回首次结果，不判版本）。
  const { data: dup } = await svc
    .from("game_events")
    .select("version,type,actor_id,payload,created_at")
    .eq("room_id", room.id)
    .eq("client_action_id", parsed.clientActionId)
    .maybeSingle();
  if (dup !== null) {
    const v = (dup as { version?: unknown }).version;
    const ver = typeof v === "number" ? v : room.version;
    const events = await getEventsSince(svc, room.id, ver - 1);
    return apiOk({ version: ver, events, replayed: true });
  }
  // 懒超时（自动动作推高 version 即原地生效；expected 对新 version 判）。
  const settled = await settleRoom(svc, room, nowMs);
  room = settled.room;
  if (parsed.expectedVersion !== room.version) {
    return apiError("stale_version", "狀態已更新，請重拉", 409);
  }
  const round = await getLatestRound(svc, room.id);
  if (round === null) {
    return apiError("internal", "找不到當前局", 500);
  }
  const members = await getActiveMembers(svc, room.id);
  const order = [...members].sort((a, b) => a.seat - b.seat).map((m) => m.user_id);
  const rules = parseRules(room.rules);
  // §九：deal_only 房只有 reveal 能用；bid／challenge 一律 409。
  const dealOnly = rules.mode === "deal_only";
  if (dealOnly && (parsed.type === "bid" || parsed.type === "challenge")) {
    return apiError("wrong_phase", "發骰器模式用 reveal 亮骰，不叫骰不開盅", 409);
  }

  // §九 reveal：任一 active 在 bidding 中可亮，不要求 last_bid／轮次；
  // 已 revealed 重调幂等 200（不写新事件）。
  if (parsed.type === "reveal") {
    if (!dealOnly) {
      return apiError("wrong_phase", "本房用 challenge 開盅，不用 reveal", 409);
    }
    if (round.status !== "bidding") {
      const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
      return apiOk({ version: room.version, events });
    }
    if (parsed.expectedVersion !== room.version) {
      return apiError("stale_version", "狀態已更新，請重拉", 409);
    }
    const done = await applyReveal(svc, room, round, userId, nowMs, parsed.clientActionId);
    if ("response" in done) return done.response;
    const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
    return apiOk({ version: done.version, events });
  }

  if (parsed.type === "bid" || parsed.type === "challenge") {
    if (round.status !== "bidding") {
      return apiError("wrong_phase", "不在叫骰階段", 409);
    }
    if (round.current_turn_user !== userId) {
      return apiError("not_your_turn", "未輪到你出手", 409);
    }
  }

  if (parsed.type === "bid") {
    const prev =
      round.last_bid !== null
        ? { qty: round.last_bid.qty, face: round.last_bid.face, zhai: round.last_bid.zhai }
        : null;
    const valid = isValidBid(prev, parsed.bid, rules);
    if (valid.ok) {
      const done = await applyBid(svc, room, round, order, userId, parsed.bid, false, nowMs, parsed.clientActionId);
      if ("response" in done) return done.response;
      const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
      return apiOk({ version: done.version, events });
    }
    return apiError("invalid_bid", valid.reason, 422);
  }

  if (parsed.type === "challenge") {
    const done = await applyChallenge(svc, room, round, userId, false, nowMs, parsed.clientActionId);
    if ("response" in done) return done.response;
    const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
    return apiOk({ version: done.version, events });
  }

  // next_round：revealed 后任何人；记确认，集齐即开新局（输家先叫）。
  if (round.status !== "revealed" || round.result === null) {
    return apiError("wrong_phase", "未開盅不可進下一局", 409);
  }
  const confirmed = new Set(round.result.confirmations);
  if (!confirmed.has(userId)) {
    confirmed.add(userId);
    const { error } = await svc
      .from("game_rounds")
      .update({ result: { ...round.result, confirmations: [...confirmed] } })
      .eq("id", round.id);
    if (error !== null) {
      console.error(`[games/actions] confirm error: code=${error.code} message=${error.message}`);
      return apiError("internal", "確認失敗", 500);
    }
  }
  const allIn = order.every((uid) => confirmed.has(uid));
  if (allIn) {
    const starter =
      typeof round.result.loser_id === "string" &&
      round.result.loser_id !== "" &&
      order.includes(round.result.loser_id)
        ? round.result.loser_id
        : order[0];
    const created = await startNextRound(svc, room.id, round.no + 1, starter, order, rules, nowMs);
    if ("response" in created) return created.response;
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) {
      return apiError("internal", "開局失敗", 500);
    }
    await appendEvent(svc, room.id, version, "round_started", userId, {
      no: round.no + 1,
      starter_id: starter,
    }, parsed.clientActionId);
    const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
    return apiOk({ version, events });
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) {
    return apiError("internal", "確認失敗", 500);
  }
  await appendEvent(svc, room.id, version, "next_round_confirmed", userId, {
    no: round.no,
    confirmed: [...confirmed],
  }, parsed.clientActionId);
  const events = await getEventsSince(svc, room.id, parsed.expectedVersion);
  return apiOk({ version, events });
}
