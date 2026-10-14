/**
 * UR G.8b 投訴＋誠信頁（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `ComplaintModels.swift`（類別／窗口／可選預判／目標過濾／文字校驗／狀態文案／錯誤）與
 * `TrustModels.swift`（等級／host 摘要／賬本）；網路形狀對 complaints×5 與 /me/trust。
 * 證據上傳本期不做（用戶定案）；文案走 key＋params。
 */

export const COMPLAINT_CATEGORIES = ["no_show", "mismatch", "harassment", "safety", "other"] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export function parseComplaintCategory(raw: unknown): ComplaintCategory | null {
  return typeof raw === "string" && (COMPLAINT_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as ComplaintCategory)
    : null;
}

export const COMPLAINT_WINDOW_HOURS = 72;
export const COMPLAINT_DETAIL_MAX = 200;
export const COMPLAINT_RESPONSE_MAX = 200;
export const COMPLAINT_APPEAL_MAX = 500;

export type ComplaintWindow = "notEnded" | "open" | "closed";

/** 投訴時間窗口（本機預判，服務端為準；iOS complaintWindow 口徑）。 */
export function complaintWindow(endMs: number, nowMs: number): ComplaintWindow {
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs)) return "notEnded";
  if (nowMs < endMs) return "notEnded";
  if (nowMs > endMs + COMPLAINT_WINDOW_HOURS * 3600_000) return "closed";
  return "open";
}

export type TextKey = { key: string; params?: Record<string, string | number> };

/** 類別可選預判（null＝可選，否則回原因 key；iOS complaintCategoryBlock 口徑）。 */
export function complaintCategoryBlock(
  c: ComplaintCategory,
  window: ComplaintWindow,
  targetIsHost: boolean,
  partyCancelled: boolean,
): TextKey | null {
  if (c === "safety") return null;
  if (window === "notEnded") return { key: "cplNotEnded" };
  if (window === "closed") return { key: "cplClosed" };
  if (c === "no_show" && partyCancelled) return { key: "cplNoShowCancelled" };
  if (c === "mismatch" && !targetIsHost) return { key: "cplMismatchHostOnly" };
  return null;
}

export type ComplaintTarget = { user_id: string; nickname: string | null; is_host: boolean };

/** 可被投訴的人（排除自己與無 id；iOS complaintTargets 口徑）。 */
export function complaintTargets(members: ComplaintTarget[], myUserId: string | null): ComplaintTarget[] {
  return members.filter((m) => {
    if (m.user_id === "") return false;
    if (myUserId !== null && m.user_id === myUserId) return false;
    return true;
  });
}

/** 投訴／申辯／申訴文字校驗（trim 後 1…max；iOS complaintTextValid 口徑）。 */
export function complaintTextValid(s: string, max: number): boolean {
  const t = s.trim();
  return t !== "" && t.length <= max;
}

/** 狀態一行字（按我的視角；iOS complaintStatusText 口徑）。 */
export function complaintStatusKey(status: string, myRole: string | null): string {
  switch (status) {
    case "awaiting_response":
      return myRole === "against" ? "cplStWaitYou" : "cplStWaitPeer";
    case "pending":
    case "triaged":
      return "cplStPending";
    case "escalated":
      return "cplStEscalated";
    case "upheld":
      return myRole === "against" ? "cplStUpheldAgainst" : "cplStUpheld";
    case "dismissed":
      return myRole === "against" ? "cplStDismissedAgainst" : "cplStDismissed";
    case "malicious":
      return myRole === "against" ? "cplStMaliciousAgainst" : "cplStMalicious";
    case "withdrawn":
      return "cplStWithdrawn";
    default:
      return "cplStPending";
  }
}

/** 服務端錯誤人話（ISO 透傳服務端；iOS complaintErrorText 口徑，時間格式化調用方做）。 */
export function complaintErrorKey(code: string | null): string | null {
  switch (code) {
    case "complaint_suspended":
      return "cplErrSuspended";
    case "rate_limited":
      return "cplErrRate";
    case "duplicate":
      return "cplErrDuplicate";
    case "not_in_party":
      return "cplErrNotInParty";
    case "not_ended":
      return "cplErrNotEnded";
    case "window_closed":
      return "cplErrClosed";
    case "rejected":
      return null;
    default:
      return null;
  }
}

// MARK: - 誠信

export type TrustTier = "newbie" | "trusted" | "normal" | "watch" | "restricted";

export function parseTrustTier(raw: unknown): TrustTier {
  switch (raw) {
    case "trusted":
    case "normal":
    case "watch":
    case "restricted":
      return raw;
    default:
      return "newbie";
  }
}

/** 壞消息等級（紅／橙調；iOS isWarning 口徑）。 */
export function trustTierWarning(tier: TrustTier): boolean {
  return tier === "watch" || tier === "restricted";
}

export type TrustLedgerItem = {
  id: string;
  delta: number;
  reason: string;
  party_place: string | null;
  created_at: string | null;
};

export function parseTrustLedgerItem(raw: unknown): TrustLedgerItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  if (typeof r.delta !== "number" || !Number.isFinite(r.delta)) return null;
  const reason = typeof r.reason_text === "string" && r.reason_text.trim() !== "" ? r.reason_text.trim() : null;
  const place = typeof r.party_place === "string" && r.party_place.trim() !== "" ? r.party_place.trim() : null;
  return {
    id: r.id,
    delta: r.delta,
    reason: reason ?? place ?? "",
    party_place: place,
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}
