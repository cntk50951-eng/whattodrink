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
 * UR L.1 上线开关（纯函数，可单测；与 HOME_UI 正交）。
 *
 * `SITE_LIVE`：缺省／非法一律 true（开站，行为与现在一致）；
 * 字面 "0"／"false"／"off"／"no"／"closed"（大小写＋首尾空白不敏感）即 false。
 * 关站时放行 Coming Soon 和公开法律页，其他访客路由的转址见 resolveSiteGate；
 * `/innerharbour` 后台由 proxy 直接放行，不进此函数。
 */

export function parseSiteLive(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  const v = String(raw).trim().toLowerCase();
  if (v === "") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no" || v === "closed") return false;
  return true;
}

/** 是否已在 coming-soon 页（含 locale 前缀变体 `/en/coming-soon`）。 */
export function isComingSoonPath(pathname: string): boolean {
  if (pathname === "/coming-soon") return true;
  const seg = pathname.split("/");
  return seg.length === 3 && seg[2] === "coming-soon";
}

/**
 * 公開法律頁（`/legal/privacy`｜`/legal/terms`｜`/legal/delete-account`，含 locale 前綴變體）。
 * App Store／Google Play 審核要能打開私隱政策與刪號說明，關站時也必須放行。
 * 只放行 `/legal` 下一層（深一層以上不算），locale 段須在 locales 內。
 */
export function isLegalPath(pathname: string, locales: readonly string[] = []): boolean {
  const clean = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  const seg = clean.split("/").slice(1); // 去掉開頭空段
  if (seg.length > 0 && locales.includes(seg[0] as string)) seg.shift();
  return seg[0] === "legal" && seg.length <= 2;
}

/**
 * 开站时返回 null。关站时放行 Coming Soon 与公开法律页，旧法律入口转到对应文件，
 * 其余访客路径转到 Coming Soon。转址保留有效的 locale 前缀。
 */
export function resolveSiteGate(
  pathname: string,
  siteLive: boolean,
  locales: readonly string[] = [],
): string | null {
  if (siteLive) return null;
  if (isComingSoonPath(pathname)) return null;
  if (isComingSoonPath(pathname.replace(/\/$/, ""))) return null;
  if (isLegalPath(pathname, locales)) return null;
  const clean = pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  const [, firstSegment] = clean.split("/");
  const localePrefix = firstSegment && locales.includes(firstSegment) ? `/${firstSegment}` : "";
  const pathWithoutLocale = clean.slice(localePrefix.length);
  // `/terms` is the app's mode guide when the site is live.
  if (pathWithoutLocale === "/privacy" || pathWithoutLocale === "/terms" || pathWithoutLocale === "/support") {
    return `${localePrefix}/legal${pathWithoutLocale}`;
  }
  return `${localePrefix}/coming-soon`;
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
