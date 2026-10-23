import type { SupabaseClient } from "@supabase/supabase-js";

import { leaveShipo, parseShipoState, type ShipoState } from "./shipo";

/**
 * 識破 shipo_states 存取（0069）。只依賴 supabase 與純引擎，rooms.ts 與路由都可引用（無循環依賴）。
 * 樂觀鎖：`rev` 比對。兩個人同時推進（如一人點指認、一人輪詢觸發超時）時只有一個寫得進，
 * 另一個重讀即可，不會寫出兩次轉移。
 */

export type ShipoStored = { state: ShipoState; rev: number };

export async function loadShipoState(svc: SupabaseClient, roomId: string): Promise<ShipoStored | null> {
  const { data, error } = await svc
    .from("shipo_states")
    .select("state,rev")
    .eq("room_id", roomId)
    .maybeSingle();
  if (error !== null) {
    // 0069 未遷移（42P01）：當作沒有局，由調用方回 500／空視圖
    if (error.code !== "42P01") console.error(`[games/shipo] load error: code=${error.code} message=${error.message}`);
    return null;
  }
  if (data === null) return null;
  const row = data as { state?: unknown; rev?: unknown };
  const state = parseShipoState(row.state);
  if (state === null || typeof row.rev !== "number") return null;
  return { state, rev: row.rev };
}

/** 開局寫入（重開一局覆蓋舊的）。 */
export async function putShipoState(svc: SupabaseClient, roomId: string, state: ShipoState): Promise<boolean> {
  const { error } = await svc.from("shipo_states").upsert({
    room_id: roomId,
    state,
    rev: 1,
    updated_at: new Date().toISOString(),
  });
  if (error !== null) {
    console.error(`[games/shipo] put error: code=${error.code} message=${error.message}`);
    return false;
  }
  return true;
}

/** 樂觀鎖寫回：rev 對得上才寫；回是否寫入成功。 */
export async function saveShipoState(
  svc: SupabaseClient,
  roomId: string,
  state: ShipoState,
  rev: number,
): Promise<boolean> {
  const { data, error } = await svc
    .from("shipo_states")
    .update({ state, rev: rev + 1, updated_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("rev", rev)
    .select("rev")
    .maybeSingle();
  if (error !== null) {
    console.error(`[games/shipo] save error: code=${error.code} message=${error.message}`);
    return false;
  }
  return data !== null;
}

export async function deleteShipoState(svc: SupabaseClient, roomId: string): Promise<void> {
  const { error } = await svc.from("shipo_states").delete().eq("room_id", roomId);
  if (error !== null && error.code !== "42P01") {
    console.error(`[games/shipo] delete error: code=${error.code} message=${error.message}`);
  }
}

/** 離場（leave／kick）：視為出局。撞樂觀鎖就重讀重試（最多 3 次）。回是否有變動。 */
export async function applyShipoLeave(
  svc: SupabaseClient,
  roomId: string,
  userId: string,
  nowMs: number,
): Promise<boolean> {
  for (let i = 0; i < 3; i += 1) {
    const cur = await loadShipoState(svc, roomId);
    if (cur === null) return false;
    const next = leaveShipo(cur.state, userId, nowMs);
    if (!next.changed) return false;
    if (await saveShipoState(svc, roomId, next.state, cur.rev)) return true;
  }
  return false;
}
