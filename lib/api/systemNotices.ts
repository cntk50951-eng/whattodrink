// 系統消息與版本更新公告（0080）：純邏輯、semver 比對、三語投影、表單校驗與安全過濾。

export type NoticeKind = "update" | "maintenance" | "announcement";
export type NoticeSeverity = "normal" | "force";
export type NoticePlatform = "ios" | "android";
export type NoticeLocale = "zh-Hant" | "zh-Hans" | "en";

export type RawNoticeBullet = {
  icon?: unknown;
  title_zh_hant?: unknown;
  title_zh_hans?: unknown;
  title_en?: unknown;
  desc_zh_hant?: unknown;
  desc_zh_hans?: unknown;
  desc_en?: unknown;
};

export type RawSystemNoticeRow = {
  id?: unknown;
  kind?: unknown;
  severity?: unknown;
  platforms?: unknown;
  max_version?: unknown;
  version_label?: unknown;
  title_zh_hant?: unknown;
  title_zh_hans?: unknown;
  title_en?: unknown;
  body_zh_hant?: unknown;
  body_zh_hans?: unknown;
  body_en?: unknown;
  bullets?: unknown;
  cta_label_zh_hant?: unknown;
  cta_label_zh_hans?: unknown;
  cta_label_en?: unknown;
  cta_url?: unknown;
  published?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
};

export type SystemNoticeBulletJson = {
  icon: string;
  title: string;
  desc: string;
};

export type SystemNoticeJson = {
  id: string;
  kind: NoticeKind;
  severity: NoticeSeverity;
  version_label: string | null;
  title: string;
  body: string;
  bullets: SystemNoticeBulletJson[];
  cta_label: string | null;
  cta_url: string | null;
  starts_at: number;
  ends_at: number | null;
};

const VALID_KINDS = new Set<string>(["update", "maintenance", "announcement"]);
const VALID_SEVERITIES = new Set<string>(["normal", "force"]);
const VALID_PLATFORMS = new Set<string>(["ios", "android"]);

function trimStr(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

/** 歸一化語言碼（支援 zh-HK / zh-TW / zh-Hant / zh-CN / zh-Hans / en / en-US）。 */
export function normalizeNoticeLocale(raw: string | null | undefined): NoticeLocale {
  const s = (raw ?? "").trim().toLowerCase();
  if (s.startsWith("en")) return "en";
  if (s.includes("hans") || s.includes("-cn") || s.includes("_cn") || s.includes("-sg")) return "zh-Hans";
  return "zh-Hant";
}

export function parseNoticePlatform(raw: string | null | undefined): NoticePlatform | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "ios" || s === "android") return s;
  return null;
}

/** 簡易 semver 解析（接受 "1.5.0"、"v1.5"、"1.5.2+34"），非數字回 null。 */
export function parseSemver(raw: string | null | undefined): [number, number, number] | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^v/i, "").split(/[-+]/)[0] ?? "";
  if (!cleaned) return null;
  const parts = cleaned.split(".");
  if (parts.length < 1 || parts.length > 3) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,5}$/.test(p)) return null;
    nums.push(Number(p));
  }
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}

export function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === null || pb === null) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** 若設了 maxVersion（如 "1.5.0"），只有安裝版本嚴格低於它的客戶端才顯示；未設 maxVersion 則全員可見。 */
export function isVersionBelow(
  clientVersion: string | null | undefined,
  maxVersion: string | null | undefined,
): boolean {
  const target = typeof maxVersion === "string" ? maxVersion.trim() : "";
  if (!target) return true;
  const cur = typeof clientVersion === "string" ? clientVersion.trim() : "";
  if (!cur) return false;
  const cmp = compareSemver(cur, target);
  return cmp !== null && cmp < 0;
}

/** 僅允許安全跳轉協定（https / App Store / Google Play），阻擋 javascript:／data:。 */
export function sanitizeNoticeUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 500) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("itms-apps://") || lower.startsWith("market://")) {
    return s;
  }
  return null;
}

function pickLocalized(zhHant: string, zhHans: string, en: string, locale: NoticeLocale): string {
  if (locale === "en") return en || zhHant || zhHans;
  if (locale === "zh-Hans") return zhHans || zhHant || en;
  return zhHant || zhHans || en;
}

export function toClientSystemNotice(
  row: RawSystemNoticeRow,
  locale: NoticeLocale,
): SystemNoticeJson | null {
  if (typeof row.id !== "string" || !row.id) return null;
  const kind = typeof row.kind === "string" && VALID_KINDS.has(row.kind) ? (row.kind as NoticeKind) : "announcement";
  const severity =
    typeof row.severity === "string" && VALID_SEVERITIES.has(row.severity)
      ? (row.severity as NoticeSeverity)
      : "normal";
  const startsMs = typeof row.starts_at === "string" ? Date.parse(row.starts_at) : NaN;
  if (!Number.isFinite(startsMs)) return null;
  const endsMs = typeof row.ends_at === "string" && row.ends_at.trim() ? Date.parse(row.ends_at) : null;
  const title = pickLocalized(
    trimStr(row.title_zh_hant, 120),
    trimStr(row.title_zh_hans, 120),
    trimStr(row.title_en, 120),
    locale,
  );
  if (!title) return null;
  const body = pickLocalized(
    trimStr(row.body_zh_hant, 600),
    trimStr(row.body_zh_hans, 600),
    trimStr(row.body_en, 600),
    locale,
  );
  const rawBullets = Array.isArray(row.bullets) ? (row.bullets as RawNoticeBullet[]) : [];
  const bullets: SystemNoticeBulletJson[] = [];
  for (const b of rawBullets.slice(0, 3)) {
    if (!b || typeof b !== "object") continue;
    const bt = pickLocalized(
      trimStr(b.title_zh_hant, 60),
      trimStr(b.title_zh_hans, 60),
      trimStr(b.title_en, 60),
      locale,
    );
    const bd = pickLocalized(
      trimStr(b.desc_zh_hant, 160),
      trimStr(b.desc_zh_hans, 160),
      trimStr(b.desc_en, 160),
      locale,
    );
    if (!bt && !bd) continue;
    bullets.push({
      icon: trimStr(b.icon, 8) || "✨",
      title: bt,
      desc: bd,
    });
  }
  const ctaLabel =
    pickLocalized(
      trimStr(row.cta_label_zh_hant, 40),
      trimStr(row.cta_label_zh_hans, 40),
      trimStr(row.cta_label_en, 40),
      locale,
    ) || null;
  const ctaUrl = sanitizeNoticeUrl(typeof row.cta_url === "string" ? row.cta_url : null);
  const maxVer = typeof row.max_version === "string" && parseSemver(row.max_version) !== null ? row.max_version : null;
  // 防磚安全門：強制更新若缺有效版本門檻、跳轉連結或按鈕文案，自動降級為 normal，避免把全量用戶鎖死
  const effectiveSeverity: NoticeSeverity =
    severity === "force" && (ctaUrl === null || maxVer === null || ctaLabel === null) ? "normal" : severity;
  const versionLabel = trimStr(row.version_label, 40) || null;
  return {
    id: row.id,
    kind,
    severity: effectiveSeverity,
    version_label: versionLabel,
    title,
    body,
    bullets,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    starts_at: startsMs,
    ends_at: endsMs !== null && Number.isFinite(endsMs) ? endsMs : null,
  };
}

export function filterActiveNotices(
  rows: RawSystemNoticeRow[],
  opts: {
    platform: NoticePlatform;
    version: string | null;
    locale: NoticeLocale;
    nowMs?: number;
    limit?: number;
  },
): SystemNoticeJson[] {
  const now = opts.nowMs ?? Date.now();
  const limit = opts.limit ?? 5;
  const matched: SystemNoticeJson[] = [];
  for (const row of rows) {
    if (row.published !== true) continue;
    const platforms = Array.isArray(row.platforms)
      ? row.platforms.filter((p): p is string => typeof p === "string" && VALID_PLATFORMS.has(p))
      : [];
    if (!platforms.includes(opts.platform)) continue;
    const maxVer = typeof row.max_version === "string" ? row.max_version : null;
    if (!isVersionBelow(opts.version, maxVer)) continue;
    const item = toClientSystemNotice(row, opts.locale);
    if (item === null) continue;
    if (item.starts_at > now) continue;
    if (item.ends_at !== null && item.ends_at <= now) continue;
    matched.push(item);
  }
  // 強制升級永遠排最前，其餘按生效時間新→舊
  matched.sort((a, b) => {
    const sa = a.severity === "force" ? 1 : 0;
    const sb = b.severity === "force" ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.starts_at - a.starts_at;
  });
  return matched.slice(0, limit);
}

export type AdminNoticePayload = {
  kind: NoticeKind;
  severity: NoticeSeverity;
  platforms: NoticePlatform[];
  max_version: string | null;
  version_label: string | null;
  title_zh_hant: string;
  title_zh_hans: string;
  title_en: string;
  body_zh_hant: string;
  body_zh_hans: string;
  body_en: string;
  bullets: {
    icon: string;
    title_zh_hant: string;
    title_zh_hans: string;
    title_en: string;
    desc_zh_hant: string;
    desc_zh_hans: string;
    desc_en: string;
  }[];
  cta_label_zh_hant: string | null;
  cta_label_zh_hans: string | null;
  cta_label_en: string | null;
  cta_url: string | null;
  published: boolean;
  starts_at: string;
  ends_at: string | null;
};

/** 校驗後台 /innerharbour/notices 表單提交（缺必填或 URL／版本格式非法回錯誤訊息）。 */
export function parseAdminNoticeForm(fd: FormData): { ok: true; data: AdminNoticePayload } | { ok: false; error: string } {
  const s = (k: string, max: number) => trimStr(fd.get(k), max);
  const kindRaw = s("kind", 20);
  const kind: NoticeKind = VALID_KINDS.has(kindRaw) ? (kindRaw as NoticeKind) : "announcement";
  const sevRaw = s("severity", 20);
  const severity: NoticeSeverity = VALID_SEVERITIES.has(sevRaw) ? (sevRaw as NoticeSeverity) : "normal";
  const platforms: NoticePlatform[] = [];
  if (fd.get("platform_ios") === "on") platforms.push("ios");
  if (fd.get("platform_android") === "on") platforms.push("android");
  if (platforms.length === 0) return { ok: false, error: "請至少勾選一個目標平台（iOS 或 Android）" };

  const titleHant = s("title_zh_hant", 120);
  if (!titleHant) return { ok: false, error: "繁體標題為必填" };

  const maxVerRaw = s("max_version", 24);
  if (maxVerRaw && parseSemver(maxVerRaw) === null) {
    return { ok: false, error: "目標版本門檻格式不正確（例：1.5.0）" };
  }

  const ctaUrlRaw = s("cta_url", 500);
  const ctaUrl = ctaUrlRaw ? sanitizeNoticeUrl(ctaUrlRaw) : null;
  if (ctaUrlRaw && ctaUrl === null) {
    return { ok: false, error: "跳轉連結僅允許 https://、itms-apps:// 或 market://" };
  }
  const ctaLabelHant = s("cta_label_zh_hant", 40) || null;
  const ctaLabelHans = s("cta_label_zh_hans", 40) || null;
  const ctaLabelEn = s("cta_label_en", 40) || null;
  if (severity === "force") {
    if (!maxVerRaw) {
      return { ok: false, error: "強制更新必須填寫目標版本門檻（例如 1.5.0），避免鎖死最新版用戶" };
    }
    if (!ctaUrl) {
      return { ok: false, error: "強制更新必須填寫有效的商店更新連結（https://、itms-apps:// 或 market://）" };
    }
    if (!ctaLabelHant && !ctaLabelHans && !ctaLabelEn) {
      return { ok: false, error: "強制更新必須填寫跳轉按鈕文案（例如「立即更新」），避免彈窗無操作出口" };
    }
  }

  const bullets: AdminNoticePayload["bullets"] = [];
  for (let i = 1; i <= 3; i += 1) {
    const btHant = s(`b${i}_title_zh_hant`, 60);
    const bdHant = s(`b${i}_desc_zh_hant`, 160);
    if (!btHant && !bdHant) continue;
    bullets.push({
      icon: s(`b${i}_icon`, 8) || "✨",
      title_zh_hant: btHant,
      title_zh_hans: s(`b${i}_title_zh_hans`, 60),
      title_en: s(`b${i}_title_en`, 60),
      desc_zh_hant: bdHant,
      desc_zh_hans: s(`b${i}_desc_zh_hans`, 160),
      desc_en: s(`b${i}_desc_en`, 160),
    });
  }

  const parseAdminDate = (raw: string): number => {
    if (!raw) return NaN;
    // datetime-local 無時區後綴，統一按香港時間 +08:00 解析，與後台頁面顯示一致
    const withTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw) ? raw : `${raw}:00+08:00`;
    return Date.parse(withTz);
  };
  const startsRaw = s("starts_at", 40);
  const startsMs = startsRaw ? parseAdminDate(startsRaw) : Date.now();
  if (!Number.isFinite(startsMs)) return { ok: false, error: "生效時間格式不正確" };
  const endsRaw = s("ends_at", 40);
  const endsMs = endsRaw ? parseAdminDate(endsRaw) : null;
  if (endsRaw && (endsMs === null || !Number.isFinite(endsMs))) {
    return { ok: false, error: "結束時間格式不正確" };
  }
  if (endsMs !== null && endsMs <= startsMs) {
    return { ok: false, error: "結束時間必須晚於生效時間" };
  }

  return {
    ok: true,
    data: {
      kind,
      severity,
      platforms,
      max_version: maxVerRaw || null,
      version_label: s("version_label", 40) || null,
      title_zh_hant: titleHant,
      title_zh_hans: s("title_zh_hans", 120),
      title_en: s("title_en", 120),
      body_zh_hant: s("body_zh_hant", 600),
      body_zh_hans: s("body_zh_hans", 600),
      body_en: s("body_en", 600),
      bullets,
      cta_label_zh_hant: ctaLabelHant,
      cta_label_zh_hans: ctaLabelHans,
      cta_label_en: ctaLabelEn,
      cta_url: ctaUrl,
      published: fd.get("published") === "on",
      starts_at: new Date(startsMs).toISOString(),
      ends_at: endsMs !== null ? new Date(endsMs).toISOString() : null,
    },
  };
}
