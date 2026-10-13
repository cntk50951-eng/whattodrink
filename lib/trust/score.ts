/**
 * UR E.30 誠信分數純函數（可單測）：衰减现算＋等级＋救濟（读时生效）。
 * DB 行不可信：逐行窄化，壞行跳過。
 */

import { TRUST_CONFIG, type TrustTier } from "./config";

export type LedgerRow = {
  kind: unknown;
  delta: unknown;
  created_at: unknown;
  expires_at: unknown;
};

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asMs(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** 单行有效分量（过期即 0；线性衰减 1−age/life）。 */
export function decayedDelta(row: LedgerRow, nowMs: number): number {
  const delta = asNum(row.delta);
  const created = asMs(row.created_at);
  const expires = asMs(row.expires_at);
  if (delta === null || created === null || expires === null) return 0;
  if (nowMs >= expires) return 0;
  const life = expires - created;
  if (life <= 0) return 0;
  return delta * (1 - (nowMs - created) / life);
}

function isNegative(row: LedgerRow): boolean {
  const d = asNum(row.delta);
  return d !== null && d < 0;
}

export type TrustScore = {
  score: number;
  completed: number;
};

/**
 * 现算（completed＝attend／hosted_completed 正分行数，全期；
 * 救濟：60 天无新违约且 ≥3 完成 → 60 天前的一般违约不计入）。
 */
export function computeTrust(rows: LedgerRow[], nowMs: number): TrustScore {
  const DAY = 24 * 3600_000;
  const cleanCut = nowMs - TRUST_CONFIG.relief_clean_days * DAY;
  const recentNeg = rows.some((r) => {
    const c = asMs(r.created_at);
    return c !== null && c >= cleanCut && isNegative(r);
  });
  const completed = rows.filter((r) => {
    const k = typeof r.kind === "string" ? r.kind : "";
    const d = asNum(r.delta);
    return (k === "attend" || k === "hosted_completed") && d !== null && d > 0;
  }).length;
  const relief = !recentNeg && completed >= TRUST_CONFIG.relief_min_completed;
  let sum = 0;
  for (const r of rows) {
    if (relief) {
      const c = asMs(r.created_at);
      if (c !== null && c < cleanCut && isNegative(r)) continue;
    }
    sum += decayedDelta(r, nowMs);
  }
  const score = Math.max(0, Math.min(100, Math.round(TRUST_CONFIG.base_score + sum)));
  return { score, completed };
}

/** 等级（newbie 不看分；其余按线）。 */
export function trustTier(score: number, completed: number): TrustTier {
  if (completed < TRUST_CONFIG.newbie_completed) return "newbie";
  if (score >= TRUST_CONFIG.tier_trusted) return "trusted";
  if (score >= TRUST_CONFIG.tier_normal) return "normal";
  if (score >= TRUST_CONFIG.tier_watch) return "watch";
  return "restricted";
}
