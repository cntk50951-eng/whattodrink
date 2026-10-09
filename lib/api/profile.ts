/**
 * UR E.18 首登資料＋個人面板（纯函数层，可单测）。
 * 性別只收 male｜female（首登二選一；secret 僅舊數據兼容顯示）；
 * dob 存生日（1900-01-01～今日）；bio 140 截；頭像只收 avatars 桶自家路徑。
 */

export type ProfileGender = "male" | "female";

export const BIO_MAX = 140;
export const DOB_MIN = "1900-01-01";

/** 生日→足歲（未来／非法回 null，调用方藏年龄，不编岁数）。 */
export function ageOf(dob: unknown, nowMs: number): number | null {
  if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const birth = Date.parse(`${dob}T00:00:00Z`);
  if (!Number.isFinite(birth) || birth > nowMs) return null;
  if (dob < DOB_MIN) return null;
  const b = new Date(birth);
  const n = new Date(nowMs);
  let age = n.getUTCFullYear() - b.getUTCFullYear();
  const md = (m: number, d: number): number => m * 100 + d;
  if (md(n.getUTCMonth(), n.getUTCDate()) < md(b.getUTCMonth(), b.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 150 ? age : null;
}

/** `PATCH /me` profile 段：全可选（ onboarding 首登由调用方判必填，不进纯函数）。 */
export function parseProfileBody(raw: unknown): {
  gender?: ProfileGender;
  dob?: string;
  bio?: string | null;
  avatar_url?: string | null;
} | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const out: {
    gender?: ProfileGender;
    dob?: string;
    bio?: string | null;
    avatar_url?: string | null;
  } = {};
  if (r.gender !== undefined) {
    if (r.gender !== "male" && r.gender !== "female") return { error: "gender 只要 male｜female" };
    out.gender = r.gender;
  }
  if (r.dob !== undefined) {
    if (typeof r.dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.dob)) {
      return { error: "dob 只要 YYYY-MM-DD" };
    }
    if (r.dob < DOB_MIN || Date.parse(`${r.dob}T00:00:00Z`) > Date.now()) {
      return { error: "dob 超出合理范围" };
    }
    // UR E.19：未成年硬拒（服務器時間算足歲；不建資，调用方 422 明拒）。
    const minorAge = ageOf(r.dob, Date.now());
    if (minorAge !== null && minorAge < 18) {
      return { error: "AGE_RESTRICTED" };
    }
    out.dob = r.dob;
  }
  if (r.bio !== undefined) {
    if (r.bio !== null && typeof r.bio !== "string") return { error: "bio 只要字符串或 null" };
    const t = typeof r.bio === "string" ? r.bio.trim() : "";
    out.bio = t === "" ? null : t.slice(0, BIO_MAX);
  }
  if (r.avatar_url !== undefined) {
    if (r.avatar_url !== null) {
      if (typeof r.avatar_url !== "string") return { error: "avatar_url 非法" };
      // 自家 avatars 桶直通；Google 頭像（lh3）沿舊口徑放行（首登預填即此源）。
      // data: 不入库（沿上传口径，先传桶再回填 URL）。
      try {
        const u = new URL(r.avatar_url);
        const isSelfBucket = u.pathname.includes("/avatars/");
        const isGoogleAvatar =
          u.hostname === "lh3.googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com");
        if (!isSelfBucket && !isGoogleAvatar) return { error: "avatar_url 只要自家 avatars 桶或 Google 頭像" };
      } catch {
        return { error: "avatar_url 非法" };
      }
      out.avatar_url = r.avatar_url;
    } else {
      out.avatar_url = null;
    }
  }
  return out;
}

/** 頭像公開讀 URL（avatars 公開桶；簽名路徑直拼，沿 Storage 公開讀口徑）。 */
export function avatarPublicUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}
/** 首登是否弹窗（onboarded 空＋7 天内新号；调用方传 created_at）。 */
export function shouldOnboard(onboardedAt: unknown, createdAt: unknown, nowMs: number): boolean {
  if (onboardedAt !== null && onboardedAt !== undefined) return false;
  if (typeof createdAt !== "string") return true;
  const c = Date.parse(createdAt);
  if (!Number.isFinite(c)) return true;
  return nowMs - c < 7 * 24 * 3600_000;
}

/** HK 日期分量（UTC+8 纯算，不依赖 Intl locale，沿 partySlotStartAt 口径）。 */
function hkParts(ms: number): { y: number; m: number; d: number; h: number } {
  const t = new Date(ms + 8 * 3600_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours() };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * UR E.27 微醺夜键（HK 时间归夜，06:00 为界：06:00 前算前一晚；含归档，调用方并集合）。
 * 非法回 null（调用方丢行，不炸统计）。
 */
export function nightKeyHK(createdAtMs: number): string | null {
  if (!Number.isFinite(createdAtMs)) return null;
  let p = hkParts(createdAtMs);
  if (p.h < 6) {
    p = hkParts(createdAtMs - 24 * 3600_000);
  }
  return `${p.y}-${pad2(p.m + 1)}-${pad2(p.d)}`;
}

/** 生日→足歲（HK 日历比较；未来／非法回 null，沿 ageOf 口径）。 */
export function hkAge(dob: unknown, nowMs: number): number | null {
  if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  if (dob < DOB_MIN) return null;
  const [ys, ms, ds] = dob.split("-").map(Number);
  const n = hkParts(nowMs);
  if (!Number.isFinite(nowMs)) return null;
  let age = n.y - ys;
  if (n.m * 100 + n.d < (ms - 1) * 100 + ds) age -= 1;
  if (ys > n.y || (ys === n.y && ((ms - 1) * 100 + ds > n.m * 100 + n.d))) return null;
  return age >= 0 && age <= 150 ? age : null;
}

/** HK 自然周一起点 ms（周一 00:00 HKT；range 归周用）。 */
export function weekStartHK(ms: number): number {
  const dayMs = 24 * 3600_000;
  const days = Math.floor((ms + 8 * 3600_000) / dayMs);
  // 1970-01-01 是周四（getUTCDay 4）；周一起点偏移：(days + 3) % 7 即周内第几天（周一=0）。
  const dowMon0 = (((days % 7) + 7) % 7 + 3) % 7;
  return (days - dowMon0) * dayMs - 8 * 3600_000;
}

/** 本周（自然周，HK）夜数（调用方传夜键集；起止 str 比，起＝周一，止＝今天）。 */
export function weekNights(nights: Set<string> | string[], nowMs: number): number {
  const s = hkParts(weekStartHK(nowMs));
  const startKey = `${s.y}-${pad2(s.m + 1)}-${pad2(s.d)}`;
  const n = hkParts(nowMs);
  const todayKey = `${n.y}-${pad2(n.m + 1)}-${pad2(n.d)}`;
  let c = 0;
  for (const k of nights) {
    if (typeof k === "string" && k >= startKey && k <= todayKey) c += 1;
  }
  return c;
}

/**
 * 连续周数（周一起；本周无则从上周起算；断一周即停，沿交接口径）。
 * 调用方传夜键集（`nightKeyHK` 产）。
 */
export function weekStreak(nights: Set<string> | string[], nowMs: number): number {
  const has = new Set(nights);
  const hasNightInWeek = (weekStart: number): boolean => {
    for (const k of has) {
      const ms = Date.parse(`${k}T12:00:00+08:00`);
      if (Number.isFinite(ms) && ms >= weekStart && ms < weekStart + 7 * 24 * 3600_000) {
        return true;
      }
    }
    return false;
  };
  let start = weekStartHK(nowMs);
  if (!hasNightInWeek(start)) start -= 7 * 24 * 3600_000;
  let streak = 0;
  while (hasNightInWeek(start)) {
    streak += 1;
    start -= 7 * 24 * 3600_000;
  }
  return streak;
}

/**
 * UR E.27 打卡行→夜／地点集合（扫描纯段；route 只负责分页拉，统计只吃这里）。
 * 非数组／坏行丢弃（调用方传什么形状都不炸，沿 toMineRow 容错口径）。
 */
export function collectNightStats(rows: unknown): { nights: Set<string>; places: Set<string> } {
  const nights = new Set<string>();
  const places = new Set<string>();
  if (!Array.isArray(rows)) return { nights, places };
  for (const r of rows) {
    if (typeof r !== "object" || r === null) continue;
    const rec = r as Record<string, unknown>;
    const ca = typeof rec.created_at === "string" ? Date.parse(rec.created_at) : NaN;
    const k = Number.isFinite(ca) ? nightKeyHK(ca) : null;
    if (k !== null) nights.add(k);
    const p = typeof rec.place_name === "string" ? rec.place_name.trim() : "";
    if (p !== "") places.add(p);
  }
  return { nights, places };
}
