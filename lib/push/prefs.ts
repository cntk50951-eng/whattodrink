/**
 * UR D.9 推送偏好（`users.push_prefs`；读缺键默认，写整体替换严格校验）。
 * 默认**全 true**（2026-11-24 用戶定案：陌生人聊天／陌生人邀約也默認開；原 stranger_invites／stranger_chat 默認 false）。
 * 客戶端（iOS／AOS）缺鍵時鏡像同一組默認，改這裡必須三端同改，否則設置頁顯示「開」而服務端按「關」處理。
 */

export const PUSH_PREF_KEYS = [
  "cheers",
  "invites",
  "invite_replies",
  "chat",
  "stranger_invites",
  "stranger_chat",
  "friends",
  "party",
  "game_invites",
] as const;

export type PushPrefKey = (typeof PUSH_PREF_KEYS)[number];

export type PushPrefs = Record<PushPrefKey, boolean>;

const DEFAULTS: PushPrefs = {
  cheers: true,
  invites: true,
  invite_replies: true,
  chat: true,
  stranger_invites: true,
  stranger_chat: true,
  friends: true,
  party: true,
  game_invites: true,
};

/** 读缺键默认（坏形回全默认，不炸包）。 */
export function pushPrefsOf(raw: unknown): PushPrefs {
  const out = { ...DEFAULTS };
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const k of PUSH_PREF_KEYS) {
    if (typeof r[k] === "boolean") out[k] = r[k];
  }
  return out;
}

/** 写整体替换（值须 boolean，未知键 400）。 */
export function parsePushPrefs(raw: unknown): { body: PushPrefs } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "push_prefs 需为对象" };
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (!(PUSH_PREF_KEYS as readonly string[]).includes(k)) {
      return { error: `未知偏好键：${k}` };
    }
    if (typeof r[k] !== "boolean") return { error: `偏好值须为 boolean：${k}` };
  }
  const body = { ...DEFAULTS };
  for (const k of PUSH_PREF_KEYS) {
    if (typeof r[k] === "boolean") body[k] = r[k];
  }
  return { body };
}

/**
 * 推送裡的名字／地點縮寫（iOS DEF-20261126-023）：鎖屏一行放不下 30 字暱稱，整串名字會把「碰了你一杯」擠到看不見。
 * 按顯示寬度截：中日韓／全形字算 2、其他算 1；超過 `maxWidth` 時保留前面、以「…」收尾（不切開 emoji／組合字）。
 * 同時去掉控制字元、零寬空格與方向控制字元，避免名字把文案順序攪亂（保留 ZWJ／ZWNJ：組合 emoji 和部分文字要靠它們）。
 */
export function pushName(raw: string, maxWidth = 16): string {
  const clean = raw.replace(/[\u0000-\u001f\u007f\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim();
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(clean), (s) => s.segment)
    : Array.from(clean);
  const width = (g: string): number => (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|[\u{1f300}-\u{1faff}]/u.test(g) ? 2 : 1);
  const total = seg.reduce((n, g) => n + width(g), 0);
  if (total <= maxWidth) return clean;
  let out = "";
  let used = 0;
  for (const g of seg) {
    const w = width(g);
    if (used + w > maxWidth - 1) break;
    out += g;
    used += w;
  }
  return `${out.trimEnd()}…`;
}

/** 推送名字寬度上限（約 8 個中文字或 16 個英文字母） */
export const PUSH_NAME_WIDTH = 16;
/** 推送地點／酒名寬度上限 */
export const PUSH_PLACE_WIDTH = 24;

/** 模板填空（{name}／{beer}／{n}；缺键留空，调用方定省略规则）。 */
export function fillPushTemplate(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** collapse-id（同类替换不堆叠：E1 按收件人）。 */
export function cheersCollapseId(recipientId: string): string {
  return `cheers-${recipientId}`;
}

/** 60s 合并标题（第 2 条起 N 個新碰杯；N 含本条；t 为文案读函数）。 */
export function cheersMergedTitle(recentCount: number, t: (k: string) => string): string {
  return t("pushCheersMulti").replace("{n}", String(recentCount + 1));
}
