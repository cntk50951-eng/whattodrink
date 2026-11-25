import type { SupabaseClient } from "@supabase/supabase-js";

import { moderateCheckin } from "../moderation";
import { writeTrustEvent } from "../trust/ledger";

export type ReportTargetType = "user" | "post" | "message";
export type ReportDecision = "actioned" | "dismissed";

const SEVERE_REASONS = new Set(["harassment", "inappropriate", "spam", "underage"]);

/** 舉報核實成立後的誠信扣分（純函數，可單測）：帖文 -6；用戶／訊息嚴重違規 -10，其餘 -6。 */
export function reportTrustDelta(targetType: ReportTargetType, reasonCode: string | null): number {
  if (targetType === "post") return -6;
  if (reasonCode !== null && SEVERE_REASONS.has(reasonCode)) return -10;
  return -6;
}

export function reportTrustKind(targetType: ReportTargetType): string {
  return targetType === "post" ? "post_report_upheld" : "user_report_upheld";
}

export function reportTrustExpireDays(targetType: ReportTargetType): number {
  return targetType === "post" ? 90 : 180;
}

/**
 * 舉報送出時寫入舉報人動態通知（report_submitted），讓舉報人在動態中查得到自己的舉報紀錄。
 * 不暴露任何敏感資料；寫入失敗不阻斷舉報主流程。
 */
export async function notifyReportSubmitted(
  svc: SupabaseClient,
  args: {
    reporterId: string;
    reportId: string;
    targetType: ReportTargetType;
    targetRef: string | null;
    reasonCode: string | null;
    placeName?: string | null;
    targetName?: string | null;
  },
): Promise<void> {
  try {
    await svc.from("notifications").insert({
      user_id: args.reporterId,
      kind: "report_submitted",
      party_id: null,
      actor_id: null,
      payload: {
        report_id: args.reportId,
        target_type: args.targetType,
        target_ref: args.targetRef,
        reason_code: args.reasonCode,
        party_place: args.placeName ?? null,
        actor_nickname: args.targetName ?? null,
      },
    });
  } catch (err) {
    console.error(`[reportStp] notifyReportSubmitted error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

/**
 * 帖文被舉報但進入人工審核時，匿名通知作者（post_reported；actor_id 恒 null，絕不洩露舉報人）。
 */
export async function notifyPostReportedUnderReview(
  svc: SupabaseClient,
  args: {
    targetUserId: string;
    reportId: string;
    targetRef: string | null;
    reasonCode: string | null;
    placeName?: string | null;
  },
): Promise<void> {
  try {
    await svc.from("notifications").insert({
      user_id: args.targetUserId,
      kind: "post_reported",
      party_id: null,
      actor_id: null,
      payload: {
        report_id: args.reportId,
        target_type: "post",
        target_ref: args.targetRef,
        reason_code: args.reasonCode,
        party_place: args.placeName ?? null,
      },
    });
  } catch (err) {
    console.error(`[reportStp] notifyPostReportedUnderReview error: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

/**
 * 舉報結案（AI STP 自動核實 或 後台管理員標記 actioned／dismissed）：
 * - actioned（成立）：
 *   1. 若為帖文，將 checkins.visibility 轉為 private（從地圖／牆／搜索立即下架）；
 *   2. 寫入 trust_events 扣誠信分（冪等 ref_id = report:<id>，同時自動發 trust_changed 通知）；
 *   3. 匿名通知被舉報人（post_actioned 或 report_actioned，actor_id 恒 null）；
 *   4. 通知舉報人結果（report_resolved，decision: actioned）。
 * - dismissed（駁回）：
 *   1. 通知舉報人結果（report_resolved，decision: dismissed）。
 *
 * 第七輪 §3.2：回傳 `{ ok }`。下架（checkins.update 回 `{error}` 不會拋）或扣分（writeTrustEvent 回 `db-error`）
 * 沒成功，就**不發任何結果通知**並回 `ok:false`，由呼叫端把案件退回待處理重跑——下架與扣分都是冪等的
 * （update 同值、trust_events 以 `report:<id>` 去重），重跑安全；通知只在業務結果成立後發。
 */
export async function applyReportDecision(
  svc: SupabaseClient,
  args: {
    reportId: string;
    targetType: ReportTargetType;
    targetRef: string | null;
    targetUserId: string;
    reporterId: string;
    reasonCode: string | null;
    placeName?: string | null;
    decision: ReportDecision;
    note?: string | null;
  },
): Promise<{ ok: boolean; failed: string[] }> {
  const failed: string[] = [];
  const cleanNote = typeof args.note === "string" && args.note.trim() !== "" ? args.note.trim() : null;
  if (args.decision === "actioned") {
    // 1. 帖文違規：立即轉為 private 下架
    if (args.targetType === "post" && args.targetRef !== null && args.targetRef !== "") {
      try {
        const { error } = await svc.from("checkins").update({ visibility: "private" }).eq("id", args.targetRef);
        if (error !== null && error !== undefined) {
          failed.push("hide");
          console.error(`[reportStp] hide checkin error: code=${(error as { code?: string }).code ?? "unknown"}`);
        }
      } catch (err) {
        failed.push("hide");
        console.error(`[reportStp] hide checkin error: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    // 下架失敗就先停：扣分會同時發 trust_changed 通知，不能在帖文還公開時就告訴被舉報人「已處理」。重跑時兩步都冪等
    if (failed.length > 0) return { ok: false, failed };
    // 2. 扣誠信分（冪等，寫入 trust_events 並觸發 trust_changed 通知）
    const delta = reportTrustDelta(args.targetType, args.reasonCode);
    try {
      const trust = await writeTrustEvent(svc, {
        user_id: args.targetUserId,
        kind: reportTrustKind(args.targetType),
        delta,
        party_id: null,
        ref_id: `report:${args.reportId}`,
        note: cleanNote,
        expires_days: reportTrustExpireDays(args.targetType),
      });
      if (!trust.written && trust.reason === "db-error") failed.push("trust");
    } catch (err) {
      failed.push("trust");
      console.error(`[reportStp] trust event error: ${err instanceof Error ? err.message : "unknown"}`);
    }
    // 業務結果沒成立：不通知任何人（否則被舉報人／舉報人會收到「已處理」而實際沒下架或沒扣分）
    if (failed.length > 0) return { ok: false, failed };
    // 3. 匿名通知被舉報人
    try {
      await svc.from("notifications").insert({
        user_id: args.targetUserId,
        kind: args.targetType === "post" ? "post_actioned" : "report_actioned",
        party_id: null,
        actor_id: null,
        payload: {
          report_id: args.reportId,
          target_type: args.targetType,
          target_ref: args.targetRef,
          reason_code: args.reasonCode,
          party_place: args.placeName ?? null,
          decision: "actioned",
          note: cleanNote,
        },
      });
    } catch (err) {
      console.error(`[reportStp] notify reported actioned error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  // 4. 通知舉報人處理結果
  try {
    await svc.from("notifications").insert({
      user_id: args.reporterId,
      kind: "report_resolved",
      party_id: null,
      actor_id: null,
      payload: {
        report_id: args.reportId,
        target_type: args.targetType,
        target_ref: args.targetRef,
        reason_code: args.reasonCode,
        party_place: args.placeName ?? null,
        decision: args.decision,
        note: cleanNote,
      },
    });
  } catch (err) {
    console.error(`[reportStp] notify reporter resolved error: ${err instanceof Error ? err.message : "unknown"}`);
  }
  return { ok: true, failed };
}

/**
 * 處分沒做完時把案件退回可重跑的狀態（只退「還是我們剛寫入的終態」的那一行，避免蓋掉別人的處理）。
 * 自動分支退回 pending（進人工隊列）；人工分支退回 reviewed（頁面只接受 pending／reviewed，可再按一次）。
 */
export async function reopenReport(
  svc: SupabaseClient,
  reportId: string,
  from: ReportDecision,
  to: "pending" | "reviewed",
): Promise<boolean> {
  try {
    const { data, error } = await svc
      .from("cheers_reports")
      .update({ status: to, decided_at: null })
      .eq("id", reportId)
      .eq("status", from)
      .select("id");
    return (error === null || error === undefined) && Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error(`[reportStp] reopen report error: ${err instanceof Error ? err.message : "unknown"}`);
    return false;
  }
}

/**
 * 帖文舉報 AI STP（Straight-Through Processing）自動分診：
 * 在 POST /api/v1/cheers/reports 回應後的 after() 內執行，不拖慢舉報提交。
 * 調用既有 OpenAI omni-moderation-latest → Minimax 審核鏈審核帖文文字／轉寫／圖片：
 * - 明確違規（flagged）：自動將舉報標為 actioned → 下架帖文 → 扣誠信分 → 通知雙方；
 * - 未命中或審核服務暫不可用：保留 pending 進 /innerharbour/user-reports 人工審核，並匿名通知帖文作者「審核中」。
 */
export async function runPostReportStp(
  svc: SupabaseClient,
  args: {
    reportId: string;
    targetRef: string;
    targetUserId: string;
    reporterId: string;
    reasonCode: string | null;
    placeName: string | null;
    note: string | null;
    transcript: string | null;
    photoUrl: string | null;
  },
): Promise<{ autoActioned: boolean; categories: string[] }> {
  const textParts = [args.placeName, args.note, args.transcript]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join("\n");
  const imageDataUrl =
    typeof args.photoUrl === "string" && args.photoUrl.startsWith("data:image/") ? args.photoUrl : undefined;

  let flagged = false;
  let categories: string[] = [];
  try {
    const verdict = await moderateCheckin(
      { text: textParts || undefined, imageDataUrl },
      {
        openaiKey: process.env.OPENAI_API_KEY,
        minimaxKey: process.env.MINIMAX_API_KEY ?? process.env.minimaxi_api_key,
        minimaxBaseUrl: process.env.MINIMAX_BASE_URL,
      },
    );
    if (verdict.flagged) {
      flagged = true;
      categories = verdict.categories;
    }
  } catch (err) {
    console.warn(`[reportStp] AI moderation failed, falling back to manual queue: ${err instanceof Error ? err.message : "unknown"}`);
  }

  if (flagged) {
    const nowIso = new Date().toISOString();
    const { data: updated } = await svc
      .from("cheers_reports")
      .update({ status: "actioned", decided_at: nowIso })
      .eq("id", args.reportId)
      .eq("status", "pending")
      .select("id");
    if (Array.isArray(updated) && updated.length > 0) {
      const catText = categories.length > 0 ? `（${categories.join(", ")}）` : "";
      const applied = await applyReportDecision(svc, {
        reportId: args.reportId,
        targetType: "post",
        targetRef: args.targetRef,
        targetUserId: args.targetUserId,
        reporterId: args.reporterId,
        reasonCode: args.reasonCode,
        placeName: args.placeName,
        decision: "actioned",
        note: `系統自動審核核實違規${catText}，已下架處理`,
      });
      if (applied.ok) return { autoActioned: true, categories };
      // 下架或扣分沒成功：案件退回 pending 交人工隊列重跑（冪等），不發「已處理」通知
      console.error(`[reportStp] auto action incomplete report=${args.reportId} failed=${applied.failed.join(",")}`);
      await reopenReport(svc, args.reportId, "actioned", "pending");
    }
  }

  // 未觸發 AI 自動處置：留待人工審核，並匿名通知帖文作者已被舉報審核中
  await notifyPostReportedUnderReview(svc, {
    targetUserId: args.targetUserId,
    reportId: args.reportId,
    targetRef: args.targetRef,
    reasonCode: args.reasonCode,
    placeName: args.placeName,
  });
  return { autoActioned: false, categories: [] };
}
