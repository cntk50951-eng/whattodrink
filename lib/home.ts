/**
 * UR C.7 首頁版本開關（純函數，可单测）。
 *
 * `HOME_UI`：intro＝裸 `/` 跳 `/intro`（介紹動畫頁，默認）；v2＝裸 `/` 跳 `/v2`（網頁版 App）；
 * v1＝`/` 走舊首頁（v1 原頁）。缺省／非法一律 intro（2026-10-23 用戶拍板：主頁默認進介紹頁；
 * 切回 v2／v1 改 env 即可；網頁版 App 仍在 `/v2`）。
 * 注意：proxy／edge 的 env 編譯期烘焙——Vercel 改值後需 redeploy 才生效。
 */

export type HomeUi = "v1" | "v2" | "intro";

/** 字面 "v1"／"v2" 各走各的；其餘（含缺省）全是 intro。 */
export function parseHomeUi(raw: unknown): HomeUi {
  if (raw === "v1") return "v1";
  if (raw === "v2") return "v2";
  return "intro";
}

/**
 * 首頁目標：裸 `/` 或 locale 根（`/zh-Hans` 等）回對應 `/intro`（intro 檔）或 `/v2`（v2 檔）；
 * 其餘一律 null（直通原鏈）。
 * 帶查詢串的 v1 深鏈（`?pick=1`／`?shoot=1`）永不劫持——v2 不認這些參數，
 * 跳過去是靜默丟功能。
 * locale 根跳帶語言路徑（`/zh-Hans`→`/zh-Hans/intro`），否則語言丟失
 * （cookie 還沒機會種下，裸路徑會落默認語言）。
 */
export function resolveHomeTarget(
  pathname: string,
  search: string,
  homeUi: HomeUi,
  locales: readonly string[] = [],
): string | null {
  if (homeUi === "v1") return null;
  if (search !== "") return null;
  const leaf = homeUi === "intro" ? "intro" : "v2";
  const clean = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  if (clean === "/") return `/${leaf}`;
  const seg = clean.split("/");
  if (seg.length === 2 && locales.includes(seg[1] as string)) {
    return `/${seg[1]}/${leaf}`;
  }
  return null;
}
