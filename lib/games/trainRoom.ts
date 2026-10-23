import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError } from "../api/envelope";
import {
  advanceTrain,
  answerTrain,
  createTrainState,
  parseTrainRules,
  type TrainState,
} from "./train";
import { appendEvent, bumpRoom, type PlayerRow, type RoomJson } from "./rooms";
import { deleteTrainState, loadTrainState, putTrainState, saveTrainState } from "./trainStore";

/**
 * UR H.4 尾班車：房間層編排（開局／懶結算／動作／再來一局）。規則全在 train.ts（純函數）。
 * 事件 payload 只放公開資訊（誰傳給誰、局結束的輸家），絕不放倒數的真實時間。
 */

export async function startTrainRoom(
  svc: SupabaseClient,
  room: RoomJson,
  members: PlayerRow[],
  userId: string,
  nowMs: number,
): Promise<{ version: number } | { response: Response }> {
  const ids = [...members].sort((a, b) => a.seat - b.seat).map((m) => m.user_id);
  const created = createTrainState(ids, parseTrainRules(room.rules), nowMs);
  if ("error" in created) return { response: apiError("invalid_params", created.error, 400) };
  if (!(await putTrainState(svc, room.id, created))) {
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const { error } = await svc.from("game_rooms").update({ status: "playing" }).eq("id", room.id);
  if (error !== null) {
    console.error(`[games/train] start status error: code=${error.code} message=${error.message}`);
    await deleteTrainState(svc, room.id);
    return { response: apiError("internal", "開局失敗", 500) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "開局失敗", 500) };
  await appendEvent(svc, room.id, version, "train_started", userId, { players: ids, holder: created.holder });
  return { version };
}

/** 懶結算：倒數到點→局結束（輸家＝拿著車的人）。撞樂觀鎖＝別人剛推進了，重讀版本即可。 */
export async function settleTrainRoom(
  svc: SupabaseClient,
  room: RoomJson,
  nowMs: number,
): Promise<{ room: RoomJson; fired: boolean }> {
  if (room.status !== "playing") return { room, fired: false };
  const cur = await loadTrainState(svc, room.id);
  if (cur === null) return { room, fired: false };
  const next = advanceTrain(cur.state, nowMs);
  if (!next.changed) return { room, fired: false };
  if (!(await saveTrainState(svc, room.id, next.state, cur.rev))) {
    const { data } = await svc.from("game_rooms").select("version").eq("id", room.id).maybeSingle();
    const v = (data as { version?: unknown } | null)?.version;
    return typeof v === "number" && v !== room.version
      ? { room: { ...room, version: v }, fired: true }
      : { room, fired: false };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { room, fired: false };
  await appendEvent(svc, room.id, version, "train_over", null, {
    loser: next.state.loser,
    passes: next.state.passes,
    auto: true,
  });
  return { room: { ...room, version }, fired: true };
}

export type TrainActionInput =
  | { type: "answer"; text: string }
  | { type: "again" }
  | { type: "rematch" };

/**
 * 執行動作（調用方已驗成員身分、版本與幂等，並先做過懶結算）。
 * answer：拿著車的人答題；again：房主，局結束後用同一批人再開一局（上局輸家先拿車）；
 * rematch：房主，局結束後回大廳（可改設定／等人）。
 */
export async function applyTrainAction(
  svc: SupabaseClient,
  room: RoomJson,
  members: PlayerRow[],
  userId: string,
  action: TrainActionInput,
  nowMs: number,
  clientActionId: string,
): Promise<{ version: number } | { response: Response }> {
  const cur = await loadTrainState(svc, room.id);
  if (cur === null) return { response: apiError("internal", "找不到當前局", 500) };

  if (action.type === "answer") {
    const res = answerTrain(cur.state, userId, action.text, nowMs);
    if (!res.ok) {
      switch (res.reason) {
        case "not_your_turn":
          return { response: apiError("not_your_turn", "未輪到你", 409) };
        case "wrong_phase":
          return { response: apiError("wrong_phase", "這局已結束", 409) };
        case "duplicate":
          return { response: apiError("duplicate", "已經有人講過了", 409) };
        default:
          return { response: apiError("invalid_answer", "不在題庫裡", 422) };
      }
    }
    if (!(await saveTrainState(svc, room.id, res.state, cur.rev))) {
      return { response: apiError("stale_version", "狀態已更新，請重拉", 409) };
    }
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) return { response: apiError("internal", "操作失敗", 500) };
    await appendEvent(svc, room.id, version, "train_pass", userId, {
      passes: res.state.passes,
      holder: res.state.holder,
      ...(res.state.event !== null ? { event: res.state.event.id } : {}),
    }, clientActionId);
    return { version };
  }

  // again／rematch：只有房主，只有局結束後
  if (room.host_id !== userId) return { response: apiError("not_host", "只有房主可操作", 403) };
  if (cur.state.phase !== "over") return { response: apiError("wrong_phase", "這局還沒結束", 409) };

  if (action.type === "rematch") {
    const { error } = await svc.from("game_rooms").update({ status: "lobby" }).eq("id", room.id);
    if (error !== null) {
      console.error(`[games/train] rematch error: code=${error.code} message=${error.message}`);
      return { response: apiError("internal", "操作失敗", 500) };
    }
    await svc.from("game_room_players").update({ ready: false }).eq("room_id", room.id).eq("status", "active");
    await deleteTrainState(svc, room.id);
    const version = await bumpRoom(svc, room.id, room.version, nowMs);
    if (version === null) return { response: apiError("internal", "操作失敗", 500) };
    await appendEvent(svc, room.id, version, "back_to_lobby", userId, { reason: "rematch" }, clientActionId);
    return { version };
  }

  // again：同一批在座的人、同一個房規；上局輸家先拿車
  const ids = [...members].sort((a, b) => a.seat - b.seat).map((m) => m.user_id);
  const fresh: TrainState | { error: string } = createTrainState(
    ids,
    cur.state.rules,
    nowMs,
    Math.random,
    cur.state.loser ?? undefined,
  );
  if ("error" in fresh) return { response: apiError("invalid_params", fresh.error, 400) };
  if (!(await saveTrainState(svc, room.id, fresh, cur.rev))) {
    return { response: apiError("stale_version", "狀態已更新，請重拉", 409) };
  }
  const version = await bumpRoom(svc, room.id, room.version, nowMs);
  if (version === null) return { response: apiError("internal", "操作失敗", 500) };
  await appendEvent(svc, room.id, version, "train_started", userId, { players: ids, holder: fresh.holder, again: true }, clientActionId);
  return { version };
}
