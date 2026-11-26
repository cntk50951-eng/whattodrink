import type { SupabaseClient } from "@supabase/supabase-js";

import { retryWrite } from "./retryWrite";

/**
 * 酒局舉報成立 → 平台取消酒局（0093；iOS DEF-20261126-006 ④）。
 * - 進行中／未開始（status=open 且未過 expires_at）：CAS open→cancelled，記 party_events，通知全部在場成員（party_cancelled＋cancel_reason=violation），補發 iOS 推送。
 * - 已取消：冪等，什麼都不做。已結束（過期或已完成）：不改狀態（取消沒有意義，看板上本來就沒了），只由呼叫端扣分。
 * - 寫狀態失敗回 error，呼叫端應停止處分（不扣分、不通知「已處理」），留待重跑。
 * 這裡不扣發起人誠信分：撤局扣分是給「發起人自己撤」的，違規扣分由舉報處分統一記一筆（party_report_upheld）。
 */
export type PartyViolationOutcome = "cancelled" | "already_cancelled" | "ended" | "not_found" | "error";

type PartyRow = { id: string; status: string; start_at: string | null; expires_at: string | null; place: string | null };

export function partyStillOpen(row: { status: string; expires_at: string | null }, nowMs: number): boolean {
  if (row.status !== "open") return false;
  const exp = row.expires_at === null ? NaN : Date.parse(row.expires_at);
  return !Number.isFinite(exp) || exp > nowMs;
}

export async function cancelPartyForViolation(
  svc: SupabaseClient,
  args: { partyId: string; reportId: string },
  nowMs: number = Date.now(),
): Promise<{ outcome: PartyViolationOutcome; notified: number }> {
  const { data: raw, error: readErr } = await svc
    .from("parties")
    .select("id,status,start_at,expires_at,place")
    .eq("id", args.partyId)
    .maybeSingle();
  if (readErr !== null && readErr !== undefined) {
    console.error(`[partyReport] read party=${args.partyId} code=${(readErr as { code?: string }).code ?? "unknown"}`);
    return { outcome: "error", notified: 0 };
  }
  const row = raw as PartyRow | null;
  if (row === null || typeof row.id !== "string") return { outcome: "not_found", notified: 0 };
  if (row.status === "cancelled") return { outcome: "already_cancelled", notified: 0 };
  if (!partyStillOpen(row, nowMs)) return { outcome: "ended", notified: 0 };

  const { data: joinRows, error: joinErr } = await svc.from("joins").select("user_id").eq("party_id", args.partyId);
  // 讀不到成員名單不能當成「沒人」：否則取消了卻沒人收到通知
  if (joinErr !== null && joinErr !== undefined) {
    console.error(`[partyReport] read joins party=${args.partyId} code=${(joinErr as { code?: string }).code ?? "unknown"}`);
    return { outcome: "error", notified: 0 };
  }
  const nowIso = new Date(nowMs).toISOString();
  const { data: updated, error: upErr } = await svc
    .from("parties")
    .update({ status: "cancelled", cancelled_at: nowIso })
    .eq("id", args.partyId)
    .eq("status", "open")
    .select("id");
  if (upErr !== null && upErr !== undefined) {
    console.error(`[partyReport] cancel party=${args.partyId} code=${(upErr as { code?: string }).code ?? "unknown"}`);
    return { outcome: "error", notified: 0 };
  }
  if (!Array.isArray(updated) || updated.length === 0) {
    // 並發：別的流程剛把局結束或取消
    const { data: nowRow } = await svc.from("parties").select("status").eq("id", args.partyId).maybeSingle();
    return { outcome: (nowRow as { status?: unknown } | null)?.status === "cancelled" ? "already_cancelled" : "ended", notified: 0 };
  }
  const joinerIds = [
    ...new Set(
      ((joinRows ?? []) as { user_id?: unknown }[])
        .map((j) => j.user_id)
        .filter((v): v is string => typeof v === "string" && v !== ""),
    ),
  ];
  try {
    await svc.from("party_events").insert({ party_id: args.partyId, user_id: null, kind: "cancel_violation", joiners_count: joinerIds.length });
  } catch {
    // 事件流水只供統計，不影響取消
  }
  if (joinerIds.length > 0) {
    const { error: nErr } = await retryWrite(() => svc.from("notifications").insert(
      joinerIds.map((uid) => ({
        user_id: uid,
        kind: "party_cancelled",
        party_id: args.partyId,
        actor_id: null,
        payload: { party_place: row.place, start_at: row.start_at, cancel_reason: "violation", report_id: args.reportId },
      })),
    ));
    if (nErr !== null && nErr !== undefined) {
      console.error(`[partyReport] [needs-repair] notify members party=${args.partyId} code=${nErr.code ?? "unknown"}`);
    }
    // 動態載入：push/send 依賴服務端環境，靜態引入會把整條推送鏈拖進 reportStp 的單測
    const { sendPartyNoticePush } = await import("../push/send");
    await sendPartyNoticePush({
      kind: "party_cancelled",
      recipientIds: joinerIds,
      actorId: "",
      actorName: "",
      place: row.place ?? "",
      partyId: args.partyId,
      iosOnly: true,
      reason: "violation",
    });
  }
  return { outcome: "cancelled", notified: joinerIds.length };
}

/** 舉報對象的地點名（帖子＝checkins.place_name、酒局＝parties.place；其他／查不到回 null）：後台處分與補發通知用 */
export async function reportPlaceName(svc: SupabaseClient, targetType: string, targetRef: string | null): Promise<string | null> {
  if (targetRef === null || (targetType !== "post" && targetType !== "party")) return null;
  try {
    const { data } = targetType === "post"
      ? await svc.from("checkins").select("place_name").eq("id", targetRef).maybeSingle()
      : await svc.from("parties").select("place").eq("id", targetRef).maybeSingle();
    const raw = (data as { place_name?: unknown; place?: unknown } | null);
    const pn = targetType === "post" ? raw?.place_name : raw?.place;
    return typeof pn === "string" && pn.trim() !== "" ? pn.trim() : null;
  } catch {
    return null;
  }
}
