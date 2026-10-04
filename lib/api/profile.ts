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
