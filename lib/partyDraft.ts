/**
 * UR G.9 發局草稿（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `PartyDraft.swift`（7 天草稿＋記住上次＋再開一局＋席位消毒）；
 * 存取走 localStorage（按帳號分桶，key 帶 uid），本文件只做純邏輯＋序列化。
 * web 表單字段子集：place／city／slot-custom／seats／bill（無 purposes／intro，iOS 獨有不搬）。
 */

export const DRAFT_KEEP_DAYS = 7;
export const DRAFT_MIN_LEAD_MIN = 30;
export const PUBLISH_WINDOW_DAYS = 14;

export type PartySlotName = "now" | "half" | "tonight" | "custom";

export type PartyDraftBar = { name: string; lat: number | null; lng: number | null };

export type PartyDraft = {
  bar: PartyDraftBar | null;
  city: string;
  startAt: number | null;
  totalSeats: number;
  maleSeats: number;
  femaleSeats: number;
  bill: string;
  savedAt: number;
};

export type PartyPrefs = {
  bill: string;
  totalSeats: number;
  maleSeats: number;
  femaleSeats: number;
  city: string;
  usualHour: number | null;
  usualMinute: number | null;
};

export function blankDraft(nowMs: number): PartyDraft {
  return {
    bar: null,
    city: "",
    startAt: null,
    totalSeats: 6,
    maleSeats: 0,
    femaleSeats: 0,
    bill: "flexible",
    savedAt: nowMs,
  };
}

/** 草稿是否過期（7 天；iOS partyDraftExpired 口徑）。 */
export function draftExpired(savedAt: number, nowMs: number): boolean {
  if (!Number.isFinite(savedAt) || !Number.isFinite(nowMs)) return true;
  return nowMs - savedAt > DRAFT_KEEP_DAYS * 24 * 3600_000;
}

/** 草稿有無內容（空表單不存；iOS partyDraftMeaningful 口徑：有店名或改過席位／買單）。 */
export function draftMeaningful(d: PartyDraft): boolean {
  if (d.bar !== null && d.bar.name.trim() !== "") return true;
  if (d.city.trim() !== "") return true;
  if (d.startAt !== null) return true;
  return d.totalSeats !== 6 || d.maleSeats !== 0 || d.femaleSeats !== 0 || d.bill !== "flexible";
}

/** 席位消毒（非法退回安全默認；minMembers web 固定 2 不存；iOS sanitized 口徑）。 */
export function sanitizedDraft(d: PartyDraft): PartyDraft {
  const x: PartyDraft = { ...d };
  const seatsOk =
    Number.isInteger(x.totalSeats) &&
    x.totalSeats >= 2 &&
    x.totalSeats <= 12 &&
    Number.isInteger(x.maleSeats) &&
    Number.isInteger(x.femaleSeats) &&
    x.maleSeats >= 0 &&
    x.femaleSeats >= 0 &&
    x.maleSeats + x.femaleSeats <= x.totalSeats;
  if (!seatsOk) {
    x.totalSeats = 6;
    x.maleSeats = 0;
    x.femaleSeats = 0;
  }
  if (x.bill !== "host" && x.bill !== "aa" && x.bill !== "flexible") x.bill = "flexible";
  return x;
}

/** 草稿時間還能不能用（已過／不足 30min 前置／超 14 天窗即丟；iOS restoredStart 口徑）。 */
export function restoredStartAt(d: PartyDraft, nowMs: number): number | null {
  const s = d.startAt;
  if (s === null || !Number.isFinite(s)) return null;
  if (s - nowMs < DRAFT_MIN_LEAD_MIN * 60_000) return null;
  if (s > nowMs + PUBLISH_WINDOW_DAYS * 24 * 3600_000 - 60_000) return null;
  return s;
}

function parseBar(raw: unknown): PartyDraftBar | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || r.name === "") return null;
  const lat = typeof r.lat === "number" && Number.isFinite(r.lat) ? r.lat : null;
  const lng = typeof r.lng === "number" && Number.isFinite(r.lng) ? r.lng : null;
  return { name: r.name, lat, lng };
}

/** 反序列化（壞 JSON／壞形回 null；iOS loadDraft 口徑＋消毒）。 */
export function parseDraft(raw: unknown, nowMs: number): PartyDraft | null {
  let obj: unknown = raw;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  const r = obj as Record<string, unknown>;
  const savedAt = typeof r.savedAt === "number" ? r.savedAt : NaN;
  if (draftExpired(savedAt, nowMs)) return null;
  const d: PartyDraft = {
    bar: parseBar(r.bar),
    city: typeof r.city === "string" ? r.city : "",
    startAt: typeof r.startAt === "number" ? r.startAt : null,
    totalSeats: typeof r.totalSeats === "number" ? r.totalSeats : 6,
    maleSeats: typeof r.maleSeats === "number" ? r.maleSeats : 0,
    femaleSeats: typeof r.femaleSeats === "number" ? r.femaleSeats : 0,
    bill: typeof r.bill === "string" ? r.bill : "flexible",
    savedAt,
  };
  const s = sanitizedDraft(d);
  if (!draftMeaningful(s)) return null;
  return { ...s, startAt: restoredStartAt(s, nowMs) };
}

export function parsePrefs(raw: unknown): PartyPrefs | null {
  let obj: unknown = raw;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  const r = obj as Record<string, unknown>;
  const bill = typeof r.bill === "string" ? r.bill : "flexible";
  const uh = typeof r.usualHour === "number" ? r.usualHour : null;
  const um = typeof r.usualMinute === "number" ? r.usualMinute : null;
  return {
    bill: bill === "host" || bill === "aa" || bill === "flexible" ? bill : "flexible",
    totalSeats: typeof r.totalSeats === "number" ? Math.trunc(r.totalSeats) : 6,
    maleSeats: typeof r.maleSeats === "number" ? Math.trunc(r.maleSeats) : 0,
    femaleSeats: typeof r.femaleSeats === "number" ? Math.trunc(r.femaleSeats) : 0,
    city: typeof r.city === "string" ? r.city : "",
    usualHour: uh !== null && Number.isInteger(uh) && uh >= 0 && uh < 24 ? uh : null,
    usualMinute: um !== null && Number.isInteger(um) && um >= 0 && um < 60 ? um : null,
  };
}

/** 發布成功後記住（介紹不記；常用時段取 HK 小時分；iOS PartyPrefs(from:) 口徑）。 */
export function prefsFromDraft(d: PartyDraft, startMs: number): PartyPrefs {
  const s = sanitizedDraft(d);
  const hk = new Date(startMs + 8 * 3600_000);
  return {
    bill: s.bill,
    totalSeats: s.totalSeats,
    maleSeats: s.maleSeats,
    femaleSeats: s.femaleSeats,
    city: s.city,
    usualHour: hk.getUTCHours(),
    usualMinute: hk.getUTCMinutes(),
  };
}

/** 偏好套到空白草稿（iOS applied(to:) 口徑）。 */
export function applyPrefs(p: PartyPrefs, nowMs: number): PartyDraft {
  return sanitizedDraft({
    ...blankDraft(nowMs),
    city: p.city,
    totalSeats: p.totalSeats,
    maleSeats: p.maleSeats,
    femaleSeats: p.femaleSeats,
    bill: p.bill,
  });
}

export type ReopenSource = {
  place: string;
  city: string;
  lat: number | null;
  lng: number | null;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  bill_intent: string;
};

/** 再開一局預填（時間留空用默認；iOS reopening 口徑，web 無 intro／purposes）。 */
export function reopenDraft(src: ReopenSource, nowMs: number): PartyDraft {
  const d: PartyDraft = {
    ...blankDraft(nowMs),
    bar: src.place !== "" ? { name: src.place, lat: src.lat, lng: src.lng } : null,
    city: src.city,
    totalSeats: src.seats_total,
    maleSeats: src.seats_male,
    femaleSeats: src.seats_female,
    bill: src.bill_intent,
  };
  return sanitizedDraft(d);
}

/** 是否該顯示「再開一局」（我的局＋已結束／已撤銷；iOS partyCanReopen 口徑）。 */
export function canReopen(isMine: boolean, status: string, expiresMs: number, nowMs: number): boolean {
  if (!isMine) return false;
  if (status === "cancelled") return true;
  return Number.isFinite(expiresMs) && nowMs >= expiresMs;
}

export function draftKey(uid: string | null): string {
  return `wtd-party-draft.v1.${uid ?? "anon"}`;
}

export function prefsKey(uid: string | null): string {
  return `wtd-party-prefs.v1.${uid ?? "anon"}`;
}
