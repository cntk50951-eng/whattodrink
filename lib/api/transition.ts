/**
 * 條件式狀態轉態的結果判定（第五輪審核：`update(...).eq("status", 舊態)` 只查資料庫 error，
 * 跨裝置同時操作時輸掉的一方更新了 0 列，卻照樣回成功並寫通知／推播／好友副作用）。
 *
 * 純函數（可單測）：路由在 `update(...).select("id")` 之後把「更新了幾列」和「現在的狀態」交進來。
 * - applied：這次請求確實把列轉到了目標態 → 可以寫通知、推播、好友等副作用。
 * - already：沒更新到列，但列已經是目標態（對方或另一個裝置先做了同一件事）→ 冪等成功，**不重複副作用**。
 * - conflict：沒更新到列，列在別的終態（例如要完成但已被撤銷）→ 回 409，不假裝成功。
 */
export type TransitionOutcome = "applied" | "already" | "conflict";

export function classifyTransition(
  updatedCount: number,
  currentStatus: string | null,
  targetStatus: string,
): TransitionOutcome {
  if (updatedCount > 0) return "applied";
  if (currentStatus === targetStatus) return "already";
  return "conflict";
}

/** supabase `update().select("id")` 的回包是否至少更新了一列（回包不是陣列一律視為 0 列，寧可不寫副作用）。 */
export function updatedRowCount(data: unknown): number {
  return Array.isArray(data) ? data.length : 0;
}
