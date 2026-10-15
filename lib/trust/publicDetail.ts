/**
 * 他人誠信詳情（主頁點誠信小格進入的頁面；產品決定 2026-10-15：越詳細越好）。
 * 只出**聚合**：按類型的次數與分值、8 週走勢、近 6 月出席次數、被投訴成立次數、等級線。
 * 不出：逐條事件、酒局／地點、投訴人與投訴內容、投訴未成立／惡意投訴（那是這個人作為投訴方的記錄，公開會傷害無辜）、退還記錄。
 */

import { TRUST_CONFIG, TRUST_KIND_TEXT } from "./config";
import { computeTrust, decayedDelta, type LedgerRow } from "./score";

const DAY = 24 * 3600_000;
const HK_OFFSET = 8 * 3600_000;

/** 公開詳情裡不展示的類型（投訴方記錄／退還） */
const HIDDEN_KINDS = new Set(["complaint_dismissed", "complaint_malicious", "leave_refund"]);
/** 算作「被投訴成立」的類型 */
const UPHELD_KINDS = new Set(["no_show", "complaint_upheld", "harassment_upheld"]);

export type TrustBreakdownItem = { kind: string; label: string; count: number; points: number; positive: boolean };
export type TrustTrendPoint = { at: string; score: number };
export type TrustMonthly = { month: string; count: number };

export type PublicTrustDetail = {
  tier_lines: { trusted: number; normal: number; watch: number; newbie_completed: number };
  breakdown: TrustBreakdownItem[];
  trend: TrustTrendPoint[];
  monthly_attend: TrustMonthly[];
  /** 近 180 天被記放鴿子／投訴成立的次數（已扣除申訴改判沖銷的） */
  upheld_180d: number;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function ms(v: unknown): number {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** 按類型聚合「還在有效期內」的事件（`:reversed` 沖銷行抵消原事件的次數與分值）。 */
export function trustBreakdown(rows: LedgerRow[], nowMs: number, includeHidden = false): TrustBreakdownItem[] {
  const acc = new Map<string, { count: number; points: number }>();
  for (const r of rows) {
    const rawKind = str(r.kind);
    if (rawKind === "") continue;
    const reversed = rawKind.endsWith(":reversed");
    const kind = reversed ? rawKind.slice(0, -":reversed".length) : rawKind;
    if (!includeHidden && HIDDEN_KINDS.has(kind)) continue;
    const expires = ms(r.expires_at);
    if (!Number.isFinite(expires) || nowMs >= expires) continue;
    const cur = acc.get(kind) ?? { count: 0, points: 0 };
    cur.count += reversed ? -1 : 1;
    cur.points += decayedDelta(r, nowMs);
    acc.set(kind, cur);
  }
  const out: TrustBreakdownItem[] = [];
  for (const [kind, v] of acc) {
    const count = Math.max(0, v.count);
    if (count === 0) continue;
    const points = Math.round(v.points * 10) / 10;
    out.push({ kind, label: TRUST_KIND_TEXT[kind] ?? kind, count, points, positive: points >= 0 });
  }
  // 加分在前（按分值大→小），扣分在後（扣得多的在前）
  return out.sort((a, b) => (a.positive === b.positive ? Math.abs(b.points) - Math.abs(a.points) : a.positive ? -1 : 1));
}

/** 近 `weeks` 週（含本週）每週一個點的分數走勢（每個點只用當時已存在的事件，按當時的衰減現算）。 */
export function trustTrend(rows: LedgerRow[], nowMs: number, weeks = 8): TrustTrendPoint[] {
  const out: TrustTrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const t = nowMs - i * 7 * DAY;
    const asOf = rows.filter((r) => {
      const c = ms(r.created_at);
      return Number.isFinite(c) && c <= t;
    });
    out.push({ at: new Date(t).toISOString(), score: computeTrust(asOf, t).score });
  }
  return out;
}

/** 近 `months` 個月（香港時間月份）出席／成局的次數，補零。 */
export function monthlyAttend(rows: LedgerRow[], nowMs: number, months = 6): TrustMonthly[] {
  const key = (t: number) => {
    const d = new Date(t + HK_OFFSET);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = str(r.kind);
    if ((k !== "attend" && k !== "hosted_completed") || num(r.delta) <= 0) continue;
    const c = ms(r.created_at);
    if (!Number.isFinite(c)) continue;
    counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
  }
  const out: TrustMonthly[] = [];
  const base = new Date(nowMs + HK_OFFSET);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ month: m, count: counts.get(m) ?? 0 });
  }
  return out;
}

/** 近 180 天被記放鴿子／投訴成立的次數（沖銷抵消）。 */
export function upheld180d(rows: LedgerRow[], nowMs: number): number {
  let n = 0;
  for (const r of rows) {
    const rawKind = str(r.kind);
    const reversed = rawKind.endsWith(":reversed");
    const kind = reversed ? rawKind.slice(0, -":reversed".length) : rawKind;
    if (!UPHELD_KINDS.has(kind)) continue;
    const c = ms(r.created_at);
    if (!Number.isFinite(c) || nowMs - c > 180 * DAY) continue;
    n += reversed ? -1 : 1;
  }
  return Math.max(0, n);
}

/** includeHidden＝本人視角（自己能看到投訴未成立／惡意投訴／退還記錄）；他人視角恒 false。 */
export function buildPublicTrustDetail(rows: LedgerRow[], nowMs: number, includeHidden = false): PublicTrustDetail {
  return {
    tier_lines: {
      trusted: TRUST_CONFIG.tier_trusted,
      normal: TRUST_CONFIG.tier_normal,
      watch: TRUST_CONFIG.tier_watch,
      newbie_completed: TRUST_CONFIG.newbie_completed,
    },
    breakdown: trustBreakdown(rows, nowMs, includeHidden),
    trend: trustTrend(rows, nowMs),
    monthly_attend: monthlyAttend(rows, nowMs),
    upheld_180d: upheld180d(rows, nowMs),
  };
}
