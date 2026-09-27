/**
 * UR C.7 首頁版本開關（純函數，可单测）。
 *
 * `HOME_UI`：v2＝裸 `/` 跳 `/v2`；v1＝`/` 走舊首頁（v1 原頁）。
 * 缺省／非法一律 v2（用戶拍板：本地＋遠端當前都要 v2；切回改 env 即可）。
 * 注意：proxy／edge 的 env 編譯期烘焙——Vercel 改值後需 redeploy 才生效。
 */

export type HomeUi = "v1" | "v2";

/** 只有字面 "v1" 才退出 v2；其餘（含缺省）全是 v2。 */
export function parseHomeUi(raw: unknown): HomeUi {
  return raw === "v1" ? "v1" : "v2";
}

/**
 * 首頁目標：僅裸 `/`＋v2 檔回 `/v2`，其餘一律 null（直通原鏈）。
 * 帶查詢串的 v1 深鏈（`?pick=1`／`?shoot=1`）永不劫持——v2 不認這些參數，
 * 跳過去是靜默丟功能。
 */
export function resolveHomeTarget(
  pathname: string,
  search: string,
  homeUi: HomeUi,
): string | null {
  if (homeUi !== "v2") return null;
  if (pathname !== "/") return null;
  if (search !== "") return null;
  return "/v2";
}
