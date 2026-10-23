import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "../api/envelope";
import {
  accuseShipo,
  advanceShipo,
  createShipoState,
  endTalkShipo,
  nextShipo,
  parseShipoRules,
  pickShipo,
  type ShipoActionResult,
  type ShipoState,
} from "./shipo";
import { appendEvent, bumpRoom, type PlayerRow, type RoomJson } from "./rooms";
import { deleteShipoState, loadShipoState, putShipoState, saveShipoState } from "./shipoStore";

/**
 * 老實人·識破：房間層編排（開局／懶結算／動作／再來一局）。規則全在 shipo.ts（純函數）。
 * 事件 payload 只放公開資訊（階段、輪次、公三小目標、指認目標），絕不放身份與真相。
 */

export async function startShipoRoom(
  svc: SupabaseClient,
  room: RoomJson,
  members: PlayerRow[],
  userId: string,
  nowMs: number,
): Promise<{ version: number } | { response: Response }> {
  const created = createShipoState(
    members.map((m) => ({ id: m.user_id, seat: m.seat })),
    room.host_id,
    parseShipoRules(room.rules),
    nowMs,
  );
  if ("error" in created) return { response: apiError("invalid_params", created.error, 400) };
  if (!(await putShipoState(svc, room.id, created))) {
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const { error } = await svc.from("game_rooms").update({ status: "playing" }).eq("id", room.id);
  if (error !== null) {
    console.error(`[games/shipo] start status error: code=${error.code} message=${error.message}`);
    await deleteShipoState(svc, room.id);
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "開局失敗", 500) };
  await appendEvent(svc, room.id, version, "shipo_started", userId, {
    players: created.order,
    round: 1,
    rounds_total: created.rounds_total,
    judge_id: created.judge_id,
    phase: "peek",
  });
  return { version };
}

function phaseEvent(state: ShipoState): { type: string; payload: Record<string, unknown> } {
  if (state.phase === "over") {
    return { type: "shipo_over", payload: { round: state.round, winners: state.winners } };
  }
  return { type: "shipo_phase", payload: { round: state.round, phase: state.phase, judge_id: state.judge_id } };
}

/** 懶結算（GET／動作前調用；無 cron）。撞樂觀鎖＝別人剛推進了，重讀版本即可。 */
export async function settleShipoRoom(
  svc: SupabaseClient,
  room: RoomJson,
  nowMs: number,
): Promise<{ room: RoomJson; fired: boolean }> {
  if (room.status !== "playing") return { room, fired: false };
  const cur = await loadShipoState(svc, room.id);
  if (cur === null) return { room, fired: false };
  const next = advanceShipo(cur.state, nowMs);
  if (!next.changed) return { room, fired: false };
  if (!(await saveShipoState(svc, room.id, next.state, cur.rev))) {
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

export type ShipoActionInput =
  | { type: "shipo_gongsansiao"; target: string }
  | { type: "shipo_end_talk" }
  | { type: "shipo_pick"; target: string }
  | { type: "shipo_next" }
  | { type: "rematch" };

const REASON_TEXT: Record<
  Exclude<ShipoActionResult, { ok: true }>["reason"],
  { code: "wrong_phase" | "not_judge" | "already_accused" | "invalid_params"; message: string; status: number }
> = {
  wrong_phase: { code: "wrong_phase", message: "現在不是這個階段", status: 409 },
  not_judge: { code: "not_judge", message: "只有想想可以操作", status: 403 },
  already_accused: { code: "already_accused", message: "這輪已經打過公三小", status: 409 },
  invalid_target: { code: "invalid_params", message: "不能選這個人", status: 400 },
  not_in_game: { code: "wrong_phase", message: "你不在這局", status: 409 },
};

/** 執行動作（調用方已驗成員身分、版本與幂等，並先做過懶結算）。 */
export async function applyShipoAction(
  svc: SupabaseClient,
  room: RoomJson,
  userId: string,
  action: ShipoActionInput,
  nowMs: number,
  clientActionId: string,
): Promise<{ version: number } | { response: Response }> {
  if (action.type === "rematch") {
    if (room.host_id !== userId) return { response: apiError("not_host", "只有房主可操作", 403) };
    const cur = await loadShipoState(svc, room.id);
    if (cur === null || cur.state.phase !== "over") {
      return { response: apiError("wrong_phase", "這局還沒結束", 409) };
    }
    const { error } = await svc.from("game_rooms").update({ status: "lobby" }).eq("id", room.id);
    if (error !== null) {
      console.error(`[games/shipo] rematch error: code=${error.code} message=${error.message}`);
      return { response: apiError("internal", "操作失敗", 500) };
    }
    await svc.from("game_room_players").update({ ready: false }).eq("room_id", room.id).eq("status", "active");
    await deleteShipoState(svc, room.id);
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) return { response: apiError("internal", "操作失敗", 500) };
    await appendEvent(svc, room.id, version, "back_to_lobby", userId, { reason: "rematch" }, clientActionId);
    return { version };
  }
  const cur = await loadShipoState(svc, room.id);
  if (cur === null) return { response: apiError("internal", "找不到當前局", 500) };
  let res: ShipoActionResult;
  switch (action.type) {
    case "shipo_gongsansiao":
      res = accuseShipo(cur.state, userId, action.target);
      break;
    case "shipo_end_talk":
      res = endTalkShipo(cur.state, userId, nowMs);
      break;
    case "shipo_pick":
      res = pickShipo(cur.state, userId, action.target, nowMs);
      break;
    case "shipo_next":
      res = nextShipo(cur.state, userId, nowMs);
      break;
  }
  if (!res.ok) {
    const t = REASON_TEXT[res.reason];
    return { response: apiError(t.code, t.message, t.status) };
  }
  if (!(await saveShipoState(svc, room.id, res.state, cur.rev))) {
    return { response: apiError("stale_version", "狀態已更新，請重拉", 409) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "操作失敗", 500) };
  // 事件只帶公開資訊：公三小目標與指認目標本就公開；身份與真相到 result 才在視圖給
  const s = res.state;
  const payload: Record<string, unknown> = { round: s.round, phase: s.phase };
  if (action.type === "shipo_gongsansiao") payload.target_id = action.target;
  if (action.type === "shipo_pick") payload.target_id = action.target;
  if (s.phase === "over") payload.winners = s.winners;
  const type =
    s.phase === "over"
      ? "shipo_over"
      : action.type === "shipo_gongsansiao"
        ? "shipo_gongsansiao"
        : action.type === "shipo_pick"
          ? "shipo_pick"
          : action.type === "shipo_end_talk"
            ? "shipo_phase"
            : "shipo_next";
  await appendEvent(svc, room.id, version, type, userId, payload, clientActionId);
  return { version };
}
