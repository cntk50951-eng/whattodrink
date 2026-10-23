import type { SupabaseClient } from "@supabase/supabase-js";

import { leaveTrain, parseTrainState, type TrainState } from "./train";

/**
 * UR H.4 train_states 存取（0068）。只依賴 supabase 與純引擎，rooms.ts 與路由都可引用（無循環依賴）。
 * 樂觀鎖：`rev` 比對，兩個人同時推進時只有一個寫得進，另一個重讀即可。
 */

export type TrainStored = { state: TrainState; rev: number };

export async function loadTrainState(svc: SupabaseClient, roomId: string): Promise<TrainStored | null> {
  const { data, error } = await svc.from("train_states").select("state,rev").eq("room_id", roomId).maybeSingle();
  if (error !== null) {
    // 0068 未遷移（42P01）：當作沒有局，由調用方回 500／空視圖
    if (error.code !== "42P01") console.error(`[games/train] load error: code=${error.code} message=${error.message}`);
    return null;
  }
  if (data === null) return null;
  const row = data as { state?: unknown; rev?: unknown };
  const state = parseTrainState(row.state);
  if (state === null || typeof row.rev !== "number") return null;
  return { state, rev: row.rev };
}

/** 開局寫入（再來一局覆蓋舊的）。 */
export async function putTrainState(svc: SupabaseClient, roomId: string, state: TrainState): Promise<boolean> {
  const { error } = await svc.from("train_states").upsert({
    room_id: roomId,
    state,
    rev: 1,
    updated_at: new Date().toISOString(),
  });
  if (error !== null) {
    console.error(`[games/train] put error: code=${error.code} message=${error.message}`);
    return false;
  }
  return true;
}

/** 樂觀鎖寫回：rev 對得上才寫；回是否寫入成功。 */
export async function saveTrainState(
  svc: SupabaseClient,
  roomId: string,
  state: TrainState,
  rev: number,
): Promise<boolean> {
  const { data, error } = await svc
    .from("train_states")
    .update({ state, rev: rev + 1, updated_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("rev", rev)
    .select("rev")
    .maybeSingle();
  if (error !== null) {
    console.error(`[games/train] save error: code=${error.code} message=${error.message}`);
    return false;
  }
  return data !== null;
}

export async function deleteTrainState(svc: SupabaseClient, roomId: string): Promise<void> {
  const { error } = await svc.from("train_states").delete().eq("room_id", roomId);
  if (error !== null && error.code !== "42P01") {
    console.error(`[games/train] delete error: code=${error.code} message=${error.message}`);
  }
}

/** 離場（leave／kick）：從座位序移除（拿著車就交給下一位）。撞樂觀鎖重讀重試（最多 3 次）。 */
export async function applyTrainLeave(svc: SupabaseClient, roomId: string, userId: string): Promise<boolean> {
  for (let i = 0; i < 3; i += 1) {
    const cur = await loadTrainState(svc, roomId);
    if (cur === null) return false;
    const next = leaveTrain(cur.state, userId);
    if (!next.changed) return false;
    if (await saveTrainState(svc, roomId, next.state, cur.rev)) return true;
  }
  return false;
}
