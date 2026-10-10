/**
 * UR D.9 推送偏好（`users.push_prefs`；读缺键默认，写整体替换严格校验）。
 * 默认全 true，唯 stranger_invites 默认 false（E.16 陌生人邀约折叠不推送）。
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
  stranger_invites: false,
  stranger_chat: false,
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
