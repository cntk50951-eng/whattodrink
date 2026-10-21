/**
 * 酒局分享落地頁（/p/<id>）的純函數：路徑判斷、深鏈、時間文案、描述文案。
 * 頁面匿名可看：只用公開酒局已經匿名可見的字段（酒吧、時間、席位、目的、買單、發起人暱稱），
 * 不含自填介紹和精確坐標。
 */

const PURPOSE_LABELS: Record<string, string> = {
  social: "交朋友", chill: "輕鬆飲酒傾偈", celebrate: "慶祝／生日", colleagues: "同事聚會", newbar: "試新酒吧",
  sports: "一齊睇波", network: "拓展人脈", language: "語言交流", other: "其他",
};
const BILL_LABELS: Record<string, string> = { host: "我買單", aa: "AA", flexible: "見面再定" };

/** proxy 對 `/p/<id>` 跳過 intl 改寫（頁面在 app/p，不在 [locale] 樹下）。 */
export function isSharePath(pathname: string): boolean {
  return /^\/p\/[A-Za-z0-9-]{1,64}\/?$/.test(pathname);
}

/** App 深鏈（自定義協議；免費開發賬號不能用通用連結，之後可疊加 Associated Domains）。 */
export function partyDeepLink(id: string): string {
  return `whattodrink://party/${encodeURIComponent(id)}`;
}

/** 香港時間文案：`10月18日 週六 21:00`。 */
export function partyWhenText(startAtIso: string): string {
  const d = new Date(startAtIso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}月${get("day")}日 ${get("weekday")} ${get("hour")}:${get("minute")}`;
}

export function partyPurposeText(purposes: unknown): string[] {
  if (!Array.isArray(purposes)) return [];
  return purposes.filter((p): p is string => typeof p === "string").map((p) => PURPOSE_LABELS[p]).filter((x): x is string => x !== undefined);
}

export function partyBillText(bill: unknown): string {
  return typeof bill === "string" ? (BILL_LABELS[bill] ?? "") : "";
}

/** 一句描述（OG／分享預覽用）：`Ping Pong 129 · 10月18日 週六 21:00 · 3/6 人 · AA`。 */
export function partyShareDescription(p: { place: string; start_at: string; seats_total: number; joined: number; bill_intent: string }): string {
  return [p.place, partyWhenText(p.start_at), `${p.joined}/${p.seats_total} 人`, partyBillText(p.bill_intent)].filter((x) => x !== "").join(" · ");
}

/** 落地頁狀態：已撤銷／已結束（開始＋3h）／可加入。 */
export function partyPageState(p: { status: unknown; expires_at: string }, nowMs: number): "cancelled" | "ended" | "open" {
  if (p.status === "cancelled") return "cancelled";
  const e = Date.parse(p.expires_at);
  if (Number.isFinite(e) && e <= nowMs) return "ended";
  return "open";
}

/** App Store 連結（env APP_STORE_URL；未上架為空）。只收 https://apps.apple.com 或 https://testflight.apple.com。 */
export function appStoreUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === "") return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    return u.hostname === "apps.apple.com" || u.hostname === "testflight.apple.com" ? u.toString() : null;
  } catch {
    return null;
  }
}
