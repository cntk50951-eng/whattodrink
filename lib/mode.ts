/**
 * UR A.16 隱身模式 — 用戶可見模式純函數（可單測）。
 * mode 三檔沿 0007（`users.mode`，預設 public）；隱身＝唯讀，任何寫操作皆攔。
 * 匿名／未載入（null）不攔，交各端點既有守衛（401 未登入／403 隱身）。
 */

export const USER_MODES = ["stealth", "friends", "public"] as const;

export type UserMode = (typeof USER_MODES)[number];

export function parseMode(raw: unknown): UserMode | null {
  return raw === "stealth" || raw === "friends" || raw === "public"
    ? raw
    : null;
}

/** 字符串数组窄化（读端透传用；非数组即 []，坏项丢弃）。 */
function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function parsePatchModeBody(
  raw: unknown,
): { body: { mode: UserMode } } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "body 需为对象" };
  }
  const mode = parseMode((raw as Record<string, unknown>).mode);
  if (mode === null) {
    return { error: "mode 非法：只要 stealth|friends|public" };
  }
  return { body: { mode } };
}

/** 隱身是否攔截寫操作：只有明確 stealth 才攔。 */
export function isWriteBlocked(mode: UserMode | null): boolean {
  return mode === "stealth";
}

export type MeJson = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  gender: "male" | "female" | "secret";
  mode: UserMode;
  mode_updated_at: string; // ISO
  /** UR E.18 加法字段（0024 未跑即 undefined，调用方按缺省处理）。 */
  dob?: string | null;
  bio?: string | null;
  onboarded_at?: string | null;
  /** UR E.19 舊號未成年旗（缺席即未知不扰；true 即弹过一次即忘）。 */
  birthRestricted?: boolean;
  /** UR E.28 口味偏好（自设；无则 null；校验在 taste.ts，读端只透传形状）。 */
  preferences?: { favorites: string[]; likes: string[]; dislikes: string[] } | null;
  /** UR D.9 推送偏好（缺键读端默认，见 pushPrefsOf；写端整体替换严格校验）。 */
  push_prefs?: Record<string, boolean> | null;
  created_at?: string;
};

/**
 * DB users 行 -> MeJson：壞行回 null（與 toMineRow 同容錯口徑）。
 * 0007 未遷移缺 mode 列時按 public 回退（沿 POST /checkins 42703 配方）。
 */
export function toMeJson(raw: unknown): MeJson | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const nickname = typeof r.nickname === "string" ? r.nickname : null;
  const avatarUrl =
    r.avatar_url === null
      ? null
      : typeof r.avatar_url === "string"
        ? r.avatar_url
        : undefined;
  const gender =
    r.gender === "male" || r.gender === "female" || r.gender === "secret"
      ? r.gender
      : null;
  const mode = parseMode(
    r.mode === undefined || r.mode === null ? "public" : r.mode,
  );
  const updatedAt =
    typeof r.mode_updated_at === "string" ? r.mode_updated_at : null;
  if (
    id === null ||
    nickname === null ||
    avatarUrl === undefined ||
    gender === null ||
    mode === null ||
    updatedAt === null
  ) {
    return null;
  }
  if (!Number.isFinite(Date.parse(updatedAt))) return null;
  const dob = r.dob === undefined || r.dob === null ? null : typeof r.dob === "string" ? r.dob : null;
  const bio = r.bio === undefined || r.bio === null ? null : typeof r.bio === "string" ? r.bio : null;
  return {
    id,
    nickname,
    avatar_url: avatarUrl,
    gender,
    mode,
    mode_updated_at: updatedAt,
    ...(dob !== undefined ? { dob } : {}),
    ...(bio !== undefined ? { bio } : {}),
    // onboarded null 显式保留（首登判定靠它；列未选即整键缺席，调用方按未知不弹）。
    ...(r.onboarded_at === undefined
      ? {}
      : { onboarded_at: typeof r.onboarded_at === "string" ? r.onboarded_at : null }),
    ...(typeof r.created_at === "string" ? { created_at: r.created_at } : {}),
    // UR D.9 推送偏好透传（对象即收，坏形回 null；默认由 pushPrefsOf 在读端补）。
    ...(r.push_prefs === undefined
      ? {}
      : {
          push_prefs:
            typeof r.push_prefs === "object" && r.push_prefs !== null
              ? (r.push_prefs as Record<string, boolean>)
              : null,
        }),
    // UR E.28 口味偏好透传（对象即收三数组，非对象即 null；校验只在写入做）。
    ...(r.preferences === undefined
      ? {}
      : {
          preferences:
            typeof r.preferences === "object" && r.preferences !== null
              ? {
                  favorites: strArr((r.preferences as Record<string, unknown>).favorites),
                  likes: strArr((r.preferences as Record<string, unknown>).likes),
                  dislikes: strArr((r.preferences as Record<string, unknown>).dislikes),
                }
              : null,
        }),
    // UR E.19：旧号未成年一次性提示（birthRestricted；缺席即未知不扰；ageOf 内联防循环 import）。
    ...(() => {
      if (r.dob === undefined) return {};
      if (typeof r.dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.dob)) return { birthRestricted: false };
      const birth = Date.parse(`${r.dob}T00:00:00Z`);
      if (!Number.isFinite(birth) || birth > Date.now()) return { birthRestricted: false };
      const b = new Date(birth);
      const n = new Date(Date.now());
      let age = n.getUTCFullYear() - b.getUTCFullYear();
      if (n.getUTCMonth() * 100 + n.getUTCDate() < b.getUTCMonth() * 100 + b.getUTCDate()) age -= 1;
      return { birthRestricted: age >= 0 && age < 18 };
    })(),
  };
}
