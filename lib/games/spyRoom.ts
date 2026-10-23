import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "../api/envelope";
import {
  advanceSpy,
  castVote,
  createSpyState,
  parseSpyRules,
  speakDone,
  type SpyActionResult,
  type SpyState,
} from "./spy";
import {
  appendEvent,
  bumpRoom,
  type PlayerRow,
  type RoomJson,
} from "./rooms";
import { deleteSpyState, loadSpyState, putSpyState, saveSpyState } from "./spyStore";

/**
 * UR H.3 誰是臥底：房間層編排（開局／懶結算／動作／再來一局）。
 * 規則全在 spy.ts（純函數）；這裡只管 DB、版本號與事件。
 * 事件 payload 只放公開資訊（階段、輪次、人數），絕不放詞與身份。
 */

/** 開局（房主；lobby→playing）。人數 4–8、全員已準備由調用方（路由）先驗。 */
export async function startSpyRoom(
  svc: SupabaseClient,
  room: RoomJson,
  members: PlayerRow[],
  userId: string,
  nowMs: number,
): Promise<{ version: number } | { response: Response }> {
  const created = createSpyState(
    members.map((m) => ({ id: m.user_id, seat: m.seat })),
    parseSpyRules(room.rules),
    nowMs,
  );
  if ("error" in created) {
    return { response: apiError("invalid_params", created.error, 400) };
  }
  if (!(await putSpyState(svc, room.id, created))) {
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const { error } = await svc.from("game_rooms").update({ status: "playing" }).eq("id", room.id);
  if (error !== null) {
    console.error(`[games/spy] start status error: code=${error.code} message=${error.message}`);
    await deleteSpyState(svc, room.id);
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "開局失敗", 500) };
  await appendEvent(svc, room.id, version, "spy_started", userId, {
    players: created.players.map((p) => p.id),
    round: 1,
    phase: "deal",
  });
  return { version };
}

function phaseEvent(state: SpyState): { type: string; payload: Record<string, unknown> } {
  if (state.phase === "over") {
    return { type: "spy_over", payload: { round: state.round, winner: state.winner } };
  }
  return { type: "spy_phase", payload: { round: state.round, phase: state.phase } };
}

/**
 * 懶結算（GET／動作前調用；無 cron）：把已到點的階段推進，寫回並 bump 版本。
 * 撞樂觀鎖＝別人剛推進了，重讀版本即可。回 `{room, fired}`。
 */
export async function settleSpyRoom(
  svc: SupabaseClient,
  room: RoomJson,
  nowMs: number,
): Promise<{ room: RoomJson; fired: boolean }> {
  if (room.status !== "playing") return { room, fired: false };
  const cur = await loadSpyState(svc, room.id);
  if (cur === null) return { room, fired: false };
  const next = advanceSpy(cur.state, nowMs);
  if (!next.changed) return { room, fired: false };
  if (!(await saveSpyState(svc, room.id, next.state, cur.rev))) {
    const { data } = await svc.from("game_rooms").select("version").eq("id", room.id).maybeSingle();
    const v = (data as { version?: unknown } | null)?.version;
    return typeof v === "number" && v !== room.version
      ? { room: { ...room, version: v }, fired: true }
      : { room, fired: false };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { room, fired: false };
  const ev = phaseEvent(next.state);
  await appendEvent(svc, room.id, version, ev.type, null, { ...ev.payload, auto: true });
  return { room: { ...room, version }, fired: true };
}

export type SpyActionInput =
  | { type: "speak_done" }
  | { type: "vote"; target: string }
  | { type: "rematch" };

const REASON_TEXT: Record<Exclude<SpyActionResult, { ok: true }>["reason"], { code: "wrong_phase" | "not_your_turn" | "invalid_params" | "duplicate"; message: string; status: number }> = {
  wrong_phase: { code: "wrong_phase", message: "現在不是這個階段", status: 409 },
  not_your_turn: { code: "not_your_turn", message: "未輪到你發言", status: 409 },
  not_alive: { code: "wrong_phase", message: "你已出局", status: 409 },
  invalid_target: { code: "invalid_params", message: "不能投這個人", status: 400 },
  already_voted: { code: "duplicate", message: "你已經投過票", status: 409 },
};

/**
 * 執行動作（調用方已驗成員身分、版本與幂等，並先做過懶結算）。
 * speak_done／vote 推進引擎；rematch（房主，僅結束後）回大廳重開。
 */
export async function applySpyAction(
  svc: SupabaseClient,
  room: RoomJson,
  userId: string,
  action: SpyActionInput,
  nowMs: number,
  clientActionId: string,
): Promise<{ version: number } | { response: Response }> {
  if (action.type === "rematch") {
    if (room.host_id !== userId) return { response: apiError("not_host", "只有房主可操作", 403) };
    const cur = await loadSpyState(svc, room.id);
    if (cur === null || cur.state.phase !== "over") {
      return { response: apiError("wrong_phase", "這局還沒結束", 409) };
    }
    const { error } = await svc.from("game_rooms").update({ status: "lobby" }).eq("id", room.id);
    if (error !== null) {
      console.error(`[games/spy] rematch error: code=${error.code} message=${error.message}`);
      return { response: apiError("internal", "操作失敗", 500) };
    }
    // 全員回到未準備；舊局狀態刪掉（下一局重新分詞分身份）
    await svc.from("game_room_players").update({ ready: false }).eq("room_id", room.id).eq("status", "active");
    await deleteSpyState(svc, room.id);
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) return { response: apiError("internal", "操作失敗", 500) };
    await appendEvent(svc, room.id, version, "back_to_lobby", userId, { reason: "rematch" }, clientActionId);
    return { version };
  }
  const cur = await loadSpyState(svc, room.id);
  if (cur === null) return { response: apiError("internal", "找不到當前局", 500) };
  const res: SpyActionResult =
    action.type === "speak_done"
      ? speakDone(cur.state, userId, nowMs)
      : castVote(cur.state, userId, action.target, nowMs);
  if (!res.ok) {
    const t = REASON_TEXT[res.reason];
    return { response: apiError(t.code, t.message, t.status) };
  }
  if (!(await saveSpyState(svc, room.id, res.state, cur.rev))) {
    return { response: apiError("stale_version", "狀態已更新，請重拉", 409) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "操作失敗", 500) };
  // 事件只帶公開資訊：投了票只說「有人投了」（actor 是誰可見，投給誰不可見）
  const payload: Record<string, unknown> =
    action.type === "speak_done"
      ? { round: res.state.round, phase: res.state.phase }
      : { round: res.state.round, phase: res.state.phase, votes_in: Object.keys(res.state.votes).length };
  const type = res.state.phase === "over" ? "spy_over" : action.type === "vote" ? "spy_vote" : "spy_speak_done";
  await appendEvent(svc, room.id, version, type, userId, {
    ...payload,
    ...(res.state.phase === "over" ? { winner: res.state.winner } : {}),
  }, clientActionId);
  return { version };
}
