import { apiError, apiOk, type ApiErrorCode } from "@/lib/api/envelope";
import type { DiceOutcome } from "@/lib/barDiceStore";

const STATUS: Record<string, number> = { not_found: 404, stale_version: 409, not_your_turn: 409, wrong_phase: 409, invalid_bid: 400, rate_limited: 429, internal: 500 };

/** 把 DiceOutcome 變成 HTTP 回包（成功回 {view, reveals, settlement}）。 */
export function respond(o: DiceOutcome): Response {
  if (o.ok) return apiOk({ view: o.view, reveals: o.reveals, settlement: o.settlement, ...(o.ivySay !== undefined ? { ivy_say: o.ivySay } : {}) });
  return apiError(o.code as ApiErrorCode, o.message, STATUS[o.code] ?? 500);
}
