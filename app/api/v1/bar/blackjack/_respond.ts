import { apiError, apiOk, type ApiErrorCode } from "@/lib/api/envelope";
import type { BjOutcome } from "@/lib/barBlackjackStore";

const STATUS: Record<string, number> = { not_found: 404, stale_version: 409, wrong_phase: 409, invalid_action: 400, rate_limited: 429, internal: 500 };

/** 把 BjOutcome 變成 HTTP 回包（成功回 {view, settlement, ivy_move?, ivy_say?}）。 */
export function respond(o: BjOutcome): Response {
  if (o.ok) {
    return apiOk({
      view: o.view,
      settlement: o.settlement,
      ...(o.ivyMove !== undefined ? { ivy_move: o.ivyMove } : {}),
      ...(o.ivySay !== undefined ? { ivy_say: o.ivySay } : {}),
    });
  }
  return apiError(o.code as ApiErrorCode, o.message, STATUS[o.code] ?? 500);
}
