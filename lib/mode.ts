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
  return {
    id,
    nickname,
    avatar_url: avatarUrl,
    gender,
    mode,
    mode_updated_at: updatedAt,
  };
}
