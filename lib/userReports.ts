/**
 * 用戶／帖子／聊天訊息舉報（iOS 上架 Apple 1.2；純函數層，可單測）。
 * 路由 `POST /api/v1/cheers/reports` 與後台隊列 `/innerharbour/user-reports` 共用本檔常量與解析。
 * 舊客戶端只傳 `{target_user_id, reason}`：照舊可用，`reason` 若形如 `harassment: 補充` 會拆出 reason_code。
 */

export const REPORT_TARGET_TYPES = ["user", "post", "message"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASON_CODES = ["harassment", "inappropriate", "spam", "underage", "other"] as const;
export type ReportReasonCode = (typeof REPORT_REASON_CODES)[number];

export const REPORT_STATUSES = ["pending", "reviewed", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** 與 openapi `reason` maxLength 同值。 */
export const REPORT_REASON_MAX = 200;
/** 證據快照每條文字上限（防巨型訊息撐爆行）。 */
export const REPORT_SNAPSHOT_TEXT_MAX = 500;
/** 同一舉報人對同一對象，這段時間內的重複舉報不再入庫（回成功，免洗版）。 */
export const REPORT_DEDUPE_MS = 24 * 3600_000;

export type ParsedReport = {
  targetType: ReportTargetType;
  /** user 類必填；post／message 由服務端按目標反查作者，此處為 null。 */
  targetUserId: string | null;
  /** post＝checkins.id、message＝messages.id；user 類為 null。 */
  targetRef: string | null;
  reasonCode: ReportReasonCode | null;
  reason: string;
};

export type ParseResult = { ok: true; value: ParsedReport } | { ok: false; message: string };

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

function idOk(v: unknown): v is string {
  return typeof v === "string" && v !== "" && v.length <= 64;
}

/** `harassment: 說明` 或單獨 `harassment` → 拆出原因碼；不是已知碼就原樣當說明。 */
export function splitLegacyReason(reason: string): { code: ReportReasonCode | null; detail: string } {
  const t = reason.trim();
  const m = /^([a-z]+)(?::\s*([\s\S]*))?$/.exec(t);
  if (m !== null && isOneOf(REPORT_REASON_CODES, m[1])) {
    return { code: m[1], detail: (m[2] ?? "").trim() };
  }
  return { code: null, detail: t };
}

export function parseReportBody(raw: unknown, selfId: string): ParseResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, message: "body 需为 JSON" };
  const r = raw as Record<string, unknown>;

  const targetType = r.target_type === undefined ? "user" : r.target_type;
  if (!isOneOf(REPORT_TARGET_TYPES, targetType)) return { ok: false, message: "target_type 非法" };

  let reasonCode: ReportReasonCode | null = null;
  if (r.reason_code !== undefined && r.reason_code !== null) {
    if (!isOneOf(REPORT_REASON_CODES, r.reason_code)) return { ok: false, message: "reason_code 非法" };
    reasonCode = r.reason_code;
  }
  let reason = typeof r.reason === "string" ? r.reason.trim().slice(0, REPORT_REASON_MAX) : "";
  if (reasonCode === null && reason !== "") {
    const legacy = splitLegacyReason(reason);
    reasonCode = legacy.code;
    // 拆出原因碼後，reason 只留說明部分（碼已進 reason_code 欄）
    if (legacy.code !== null) reason = legacy.detail;
  }

  if (targetType === "user") {
    if (!idOk(r.target_user_id) || r.target_user_id === selfId) return { ok: false, message: "target_user_id 非法" };
    return { ok: true, value: { targetType, targetUserId: r.target_user_id, targetRef: null, reasonCode, reason } };
  }
  if (!idOk(r.target_id)) return { ok: false, message: "target_id 非法" };
  return { ok: true, value: { targetType, targetUserId: null, targetRef: r.target_id, reasonCode, reason } };
}

/** 隊列排序：未成年最前，其次騷擾／不當內容，再垃圾訊息，最後其他／未填。數字小＝優先。 */
export function reportPriority(code: string | null | undefined): number {
  switch (code) {
    case "underage": return 0;
    case "harassment":
    case "inappropriate": return 1;
    case "spam": return 2;
    default: return 3;
  }
}

/** 隊列排序鍵：待處理在前，同狀態按優先級，再按時間新到舊（由呼叫端用 localeCompare 比 created_at）。 */
export function reportRank(r: { status?: unknown; reason_code?: unknown }): number {
  return (r.status === "pending" ? 0 : 10) + reportPriority(typeof r.reason_code === "string" ? r.reason_code : null);
}

export type SnapshotLine = { who: "reported" | "reporter" | "other"; kind: string; text: string; at: string | null };

export function clipSnapshotText(s: string | null | undefined): string {
  return (s ?? "").slice(0, REPORT_SNAPSHOT_TEXT_MAX);
}

/** 把一條訊息（含發送者）標成證據行；圖片／語音只記類型，不存檔案路徑。 */
export function messageEvidence(
  m: { sender_id: string; kind: string; body: string | null; created_at: string | null },
  reportedId: string,
  reporterId: string,
): SnapshotLine {
  const who = m.sender_id === reportedId ? "reported" : m.sender_id === reporterId ? "reporter" : "other";
  const text = m.kind === "text" ? clipSnapshotText(m.body) : `[${m.kind}]${m.body ? ` ${clipSnapshotText(m.body)}` : ""}`;
  return { who, kind: m.kind, text, at: m.created_at };
}
