/**
 * UR G.8 酒局進行時（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `NoticeModels.swift`（政策文案）／`AttendanceModels.swift`（窗口／結果／打卡失敗）／
 * `TrustModels.swift`（host 摘要）；網路形狀對 parties 行（cancel_policy／leave_policy／host.trust）、
 * attendance（`{pending, role, closes_at, window_closed, members, host, my_host_attended, my_outcome}`）、
 * arrive（`{arrived, arrived_at}`）。文案走 key＋params，調用方經 i18n。
 */

export type CancelPolicy = { can_cancel: boolean; block_reason: string | null; joiners_count: number };

export type LeavePolicy = { can_leave: boolean; minutes_to_start: number; late: boolean };

export type HostTrust = { tier: string | null; hosted_count: number; completion_rate: number | null; cancel_90d: number };

function num(v: unknown, dflt = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}

export function parseCancelPolicy(raw: unknown): CancelPolicy | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.can_cancel !== "boolean") return null;
  const br = typeof r.block_reason === "string" ? r.block_reason : null;
  return { can_cancel: r.can_cancel, block_reason: br, joiners_count: Math.max(0, Math.floor(num(r.joiners_count))) };
}

export function parseLeavePolicy(raw: unknown): LeavePolicy | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.can_leave !== "boolean") return null;
  return {
    can_leave: r.can_leave,
    minutes_to_start: Math.trunc(num(r.minutes_to_start)),
    late: r.late === true,
  };
}

export function parseHostTrust(raw: unknown): HostTrust | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const cr = typeof r.completion_rate === "number" && Number.isFinite(r.completion_rate) ? r.completion_rate : null;
  return {
    tier: typeof r.tier === "string" ? r.tier : null,
    hosted_count: Math.max(0, Math.floor(num(r.hosted_count))),
    completion_rate: cr,
    cancel_90d: Math.max(0, Math.floor(num(r.cancel_90d))),
  };
}

export type TextKey = { key: string; params?: Record<string, string | number> };

/** 撤銷鈕置灰原因（null＝可撤或不該顯示；iOS partyCancelBlockText 口徑）。 */
export function cancelBlockText(reason: string | null): TextKey | null {
  switch (reason) {
    case "too_close_to_start":
      return { key: "partyCancelClose" };
    case "started":
      return { key: "partyCancelStarted" };
    case "already_cancelled":
      return { key: "partyCancelDone" };
    default:
      return null;
  }
}

/** 撤銷確認標題：寫明會通知 N 位（iOS partyCancelConfirmTitle 口徑）。 */
export function cancelConfirmTitle(joiners: number): TextKey {
  return joiners > 0
    ? { key: "partyCancelNotify", params: { n: joiners } }
    : { key: "partyCancelNoOne" };
}

/** 退出確認訊息（iOS partyLeaveConfirmMessage 口徑）。 */
export function leaveConfirmMessage(p: LeavePolicy | null): TextKey {
  if (p !== null && p.late) {
    if (p.minutes_to_start >= 0) {
      return { key: "partyLeaveLate", params: { minutes: p.minutes_to_start } };
    }
    return { key: "partyLeaveAfterStart" };
  }
  return { key: "partyLeaveNormal" };
}

export const ARRIVE_WINDOW_MIN = 30;

/** 是否在打卡窗口內（僅決定按鈕顯示，最終以服務端為準；iOS partyArriveWindowOpen 口徑）。 */
export function arriveWindowOpen(startMs: number, nowMs: number): boolean {
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return false;
  const w = ARRIVE_WINDOW_MIN * 60_000;
  return nowMs >= startMs - w && nowMs <= startMs + w;
}

/** 結算結果人話（null＝還沒結算，不扣不加；iOS attendanceOutcomeText 口徑）。 */
export function attendanceOutcomeKey(outcome: string | null | undefined): string | null {
  switch (outcome) {
    case "attended":
      return "partyOutcomeAttended";
    case "no_show":
      return "partyOutcomeNoShow";
    case "left":
      return "partyOutcomeLeft";
    case "cancelled":
      return "partyOutcomeCancelled";
    default:
      return null;
  }
}

/**
 * 打卡失敗人話（iOS arriveFailureText 口徑）。
 * 回 key 用本地文案；回 null 即沿用服務端 message（too_far 距離／限頻等人話已在服務端）。
 */
export function arriveErrorKey(code: string | null): string | null {
  switch (code) {
    case "arrive_window_closed":
      return "partyArriveClosed";
    case "not_in_party":
      return "partyArriveNotIn";
    default:
      return null;
  }
}
