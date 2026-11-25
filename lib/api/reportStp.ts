import type { SupabaseClient } from "@supabase/supabase-js";

import { moderateCheckin, type ModerationChainResult, type ModerationInput } from "../moderation";
import { buildReportEmail, sendSupportEmail } from "../email/supportEmail";
import { routeReport, type ReportAiDecision } from "../reportTriage";
import { writeTrustEvent } from "../trust/ledger";
import { retryWrite } from "./retryWrite";

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
): Promise<{ ok: boolean; failed: string[]; notifyFailed: string[] }> {
  const failed: string[] = [];
  const notifyFailed: string[] = [];
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
    if (failed.length > 0) return { ok: false, failed, notifyFailed };
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
    if (failed.length > 0) return { ok: false, failed, notifyFailed };
    // 3. 匿名通知被舉報人。supabase 查詢回 {error} 不會拋，必須讀 error（第八輪 R8-03）；瞬時錯誤有界重試
    const toReported = await retryWrite(() => svc.from("notifications").insert({
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
    }));
    if (toReported.error !== null && toReported.error.code !== "23505") {
      notifyFailed.push("reported");
      console.error(`[reportStp] [needs-repair] notify reported report=${args.reportId} code=${toReported.error.code ?? "unknown"}`);
    }
  }
  // 4. 通知舉報人處理結果（同上：讀 error＋重試；23505 代表已寫入，視為冪等成功）
  const toReporter = await retryWrite(() => svc.from("notifications").insert({
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
  }));
  if (toReporter.error !== null && toReporter.error.code !== "23505") {
    notifyFailed.push("reporter");
    console.error(`[reportStp] [needs-repair] notify reporter report=${args.reportId} code=${toReporter.error.code ?? "unknown"}`);
  }
  // 5. 結案說明存回案件（「我的舉報」詳情顯示；0090 前沒有該欄位就略過，不影響處分結果）
  if (cleanNote !== null) {
    try {
      const { error } = await svc.from("cheers_reports").update({ decision_note: cleanNote.slice(0, 200) }).eq("id", args.reportId);
      if (error !== null && error !== undefined && !isMissingColumn(error)) {
        console.error(`[reportStp] save decision_note report=${args.reportId} code=${(error as { code?: string }).code ?? "unknown"}`);
      }
    } catch (err) {
      console.error(`[reportStp] save decision_note error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return { ok: true, failed, notifyFailed };
}

/** 0090 未遷移時新欄位不存在：42703（PostgREST 轉發）／PGRST204（schema cache 無此欄） */
function isMissingColumn(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42703" || code === "PGRST204";
}

/**
 * 第九／十輪 §3.4：檢查已結案舉報是否缺漏任一方結果通知。
 * 查詢失敗時顯式回傳 `queryError: true`，絕不靜默當成「無缺漏」。
 */
export async function findMissingReportNotifications(
  svc: SupabaseClient,
  args: {
    reportId: string;
    targetType: ReportTargetType;
    decision: ReportDecision;
    targetUserId?: string;
    reporterId?: string;
  },
): Promise<{ missingReported: boolean; missingReporter: boolean; queryError?: boolean }> {
  const reportedKind = args.targetType === "post" ? "post_actioned" : "report_actioned";
  const wantedKinds = args.decision === "actioned" ? [reportedKind, "report_resolved"] : ["report_resolved"];
  const { data, error } = await svc
    .from("notifications")
    .select("kind,user_id")
    .in("kind", wantedKinds)
    .eq("payload->>report_id", args.reportId);
  if (error !== null || !Array.isArray(data)) {
    console.error(`[reportStp] findMissingReportNotifications error report=${args.reportId} code=${error?.code ?? "unknown"}`);
    return { missingReported: false, missingReporter: false, queryError: true };
  }
  const rows = data as Array<{ kind?: unknown; user_id?: unknown }>;
  const hasMatch = (kind: string, expectedUserId?: string): boolean =>
    rows.some((row) => String(row.kind ?? "") === kind && (expectedUserId === undefined || row.user_id === undefined || String(row.user_id) === expectedUserId));
  return {
    missingReported: args.decision === "actioned" && !hasMatch(reportedKind, args.targetUserId),
    missingReporter: !hasMatch("report_resolved", args.reporterId),
  };
}

/**
 * 第九／十輪 §3.4：僅補發缺漏的那一方舉報結果通知；對賬查詢失敗直接回報 `queryError: true`，
 * 寫入遇 0087 唯一索引衝突（23505）視為已送達成功，避免並發／重試重複通知。
 */
export async function resendMissingReportNotifications(
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
): Promise<{ sent: ("reported" | "reporter")[]; failed: ("reported" | "reporter")[]; queryError?: boolean }> {
  const { missingReported, missingReporter, queryError } = await findMissingReportNotifications(svc, {
    reportId: args.reportId,
    targetType: args.targetType,
    decision: args.decision,
    targetUserId: args.targetUserId,
    reporterId: args.reporterId,
  });
  if (queryError) {
    return { sent: [], failed: [], queryError: true };
  }
  const cleanNote = typeof args.note === "string" && args.note.trim() !== "" ? args.note.trim().slice(0, 200) : null;
  const sent: ("reported" | "reporter")[] = [];
  const failed: ("reported" | "reporter")[] = [];

  if (missingReported) {
    const res = await retryWrite(() => svc.from("notifications").insert({
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
    }));
    if (res.error === null || res.error.code === "23505") sent.push("reported");
    else failed.push("reported");
  }

  if (missingReporter) {
    const res = await retryWrite(() => svc.from("notifications").insert({
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
    }));
    if (res.error === null || res.error.code === "23505") sent.push("reporter");
    else failed.push("reporter");
  }

  return { sent, failed };
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

export const REPORT_AUTO_ACTION_NOTE = "系統自動審核核實違規，已處理";
export const REPORT_AUTO_DISMISS_NOTE = "系統審核暫未發現違規；如之後有新情況，24 小時後可再次舉報";

/**
 * 舉報 AI STP（Straight-Through Processing）＋置信度分流（iOS DEF-20261125-020〜024）：
 * 在 POST /api/v1/cheers/reports 回應後的 after() 內執行，帖子／用戶／訊息三類都走。
 * 1. AI 初審（理由是 AI 判斷不了的直接跳過，省一次調用）→ `routeReport` 分流；
 * 2. 結果寫回 ai_*（0090 未遷移則略過）；
 * 3. auto_actioned：CAS pending→actioned 後處分（下架／扣分／通知雙方），處分沒成功退回 pending 轉人工；
 *    auto_dismissed：CAS pending→dismissed，通知舉報人「未發現違規」；
 *    human：帖子匿名通知作者「審核中」，並寄郵件到 support（support_emailed_at 先 CAS 佔位，寄失敗清回可重寄）。
 */
export async function runReportStp(
  svc: SupabaseClient,
  args: {
    reportId: string;
    targetType: ReportTargetType;
    targetRef: string | null;
    targetUserId: string;
    reporterId: string;
    reasonCode: string | null;
    reasonText: string | null;
    placeName: string | null;
    targetName: string | null;
    content: ModerationInput;
    /** 單測注入 */
    moderate?: (input: ModerationInput) => Promise<ModerationChainResult>;
    sendEmail?: typeof sendSupportEmail;
  },
): Promise<{ decision: ReportAiDecision; emailed: boolean }> {
  const judgeable = args.reasonCode === null || args.reasonCode === "harassment" || args.reasonCode === "inappropriate";
  let verdict: ModerationChainResult | null = null;
  if (judgeable) {
    try {
      verdict = await (args.moderate ?? ((input: ModerationInput) =>
        moderateCheckin(input, {
          openaiKey: process.env.OPENAI_API_KEY,
          minimaxKey: process.env.MINIMAX_API_KEY ?? process.env.minimaxi_api_key,
          minimaxBaseUrl: process.env.MINIMAX_BASE_URL,
        })))(args.content);
    } catch (err) {
      console.warn(`[reportStp] AI moderation failed, routing to human: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  let route = routeReport({ reasonCode: args.reasonCode, verdict });

  const saveRoute = async (decision: ReportAiDecision): Promise<void> => {
    const { error } = await svc.from("cheers_reports").update({
      ai_decision: decision,
      ai_score: route.score,
      ai_categories: route.categories.length > 0 ? route.categories : null,
      ai_route_reason: route.reason,
      ai_checked_at: new Date().toISOString(),
    }).eq("id", args.reportId);
    if (error !== null && error !== undefined && !isMissingColumn(error)) {
      console.error(`[reportStp] save ai route report=${args.reportId} code=${(error as { code?: string }).code ?? "unknown"}`);
    }
  };

  if (route.decision === "auto_actioned" || route.decision === "auto_dismissed") {
    const target = route.decision === "auto_actioned" ? "actioned" : "dismissed";
    const { data: updated } = await svc
      .from("cheers_reports")
      .update({ status: target, decided_at: new Date().toISOString() })
      .eq("id", args.reportId)
      .eq("status", "pending")
      .select("id");
    if (Array.isArray(updated) && updated.length > 0) {
      await saveRoute(route.decision);
      const catText = route.categories.length > 0 ? `（${route.categories.join(", ")}）` : "";
      const applied = await applyReportDecision(svc, {
        reportId: args.reportId,
        targetType: args.targetType,
        targetRef: args.targetRef,
        targetUserId: args.targetUserId,
        reporterId: args.reporterId,
        reasonCode: args.reasonCode,
        placeName: args.placeName,
        decision: target,
        note: target === "actioned" ? `${REPORT_AUTO_ACTION_NOTE}${catText}` : REPORT_AUTO_DISMISS_NOTE,
      });
      if (applied.ok) return { decision: route.decision, emailed: false };
      // 處分沒做完：退回 pending 轉人工（冪等可重跑），不發「已處理」
      console.error(`[reportStp] auto ${target} incomplete report=${args.reportId} failed=${applied.failed.join(",")}`);
      const reopened = await reopenReport(svc, args.reportId, target, "pending");
      if (!reopened) console.error(`[reportStp] [needs-repair] reopen failed report=${args.reportId} (案件停在 ${target} 但處分未完成)`);
    }
    // 沒搶到（已被人工處理）或處分失敗：當人工案件處理
    route = { ...route, decision: "human", reason: "ai_unavailable" };
  }

  await saveRoute("human");
  if (args.targetType === "post") {
    await notifyPostReportedUnderReview(svc, {
      targetUserId: args.targetUserId,
      reportId: args.reportId,
      targetRef: args.targetRef,
      reasonCode: args.reasonCode,
      placeName: args.placeName,
    });
  }
  const emailed = await emailSupportOnce(svc, args, route);
  return { decision: "human", emailed };
}

/** 人工案件寄一次郵件：先把 support_emailed_at 從 NULL 佔位（並發只有一方寄），寄失敗清回 NULL 以便重寄 */
async function emailSupportOnce(
  svc: SupabaseClient,
  args: { reportId: string; targetType: ReportTargetType; reasonCode: string | null; reasonText: string | null; targetName: string | null; sendEmail?: typeof sendSupportEmail },
  route: ReturnType<typeof routeReport>,
): Promise<boolean> {
  let claimed = true;
  const { data: claim, error: claimError } = await svc
    .from("cheers_reports")
    .update({ support_emailed_at: new Date().toISOString() })
    .eq("id", args.reportId)
    .is("support_emailed_at", null)
    .select("id");
  if (claimError !== null && claimError !== undefined) {
    // 0090 未遷移：無法去重，但 after() 每宗只跑一次，照寄；其他錯誤不寄（避免重複），記日誌
    if (!isMissingColumn(claimError)) {
      console.error(`[reportStp] [needs-repair] email claim failed report=${args.reportId} code=${(claimError as { code?: string }).code ?? "unknown"}`);
      return false;
    }
  } else if (!Array.isArray(claim) || claim.length === 0) {
    claimed = false;
  }
  if (!claimed) return false;
  const mail = buildReportEmail({
    reportId: args.reportId,
    targetType: args.targetType,
    reasonCode: args.reasonCode,
    reasonText: args.reasonText,
    targetName: args.targetName,
    routeReason: route.reason,
    score: route.score,
    categories: route.categories,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  const sent = await (args.sendEmail ?? sendSupportEmail)(mail, { idempotencyKey: `report-human-${args.reportId}` });
  if (sent.ok) return true;
  console.error(`[reportStp] [needs-repair] support email failed report=${args.reportId} status=${sent.status ?? "none"} ${sent.error}`);
  await svc.from("cheers_reports").update({ support_emailed_at: null }).eq("id", args.reportId);
  return false;
}

/**
 * 管理員推翻 AI 自動結案（auto_dismissed → 成立）：用戶要求「dashboard 可更新人工審核結果」。
 * 1. CAS：只動仍是 dismissed＋ai_decision=auto_dismissed 的那一行（防與其他處理撞車）；
 * 2. 照常處分（下架／扣分／通知被舉報人）；處分沒成功就把案件退回 dismissed（冪等，可再按）；
 * 3. 舉報人那條 report_resolved 受 0087 唯一索引限制不能再插一條 → 改寫原通知（decision=actioned、置頂、標未讀）。
 * 反向（成立 → 不成立）要還原下架與誠信分，本期不做。
 */
export async function overrideAutoDismissal(
  svc: SupabaseClient,
  args: {
    reportId: string;
    adminId: string;
    targetType: ReportTargetType;
    targetRef: string | null;
    targetUserId: string;
    reporterId: string;
    reasonCode: string | null;
    placeName?: string | null;
    note: string;
  },
): Promise<{ ok: boolean; failed: string[]; notifyFailed: string[] }> {
  const { data: claimed, error } = await svc
    .from("cheers_reports")
    .update({ status: "actioned", decided_by: args.adminId, decided_at: new Date().toISOString() })
    .eq("id", args.reportId)
    .eq("status", "dismissed")
    .eq("ai_decision", "auto_dismissed")
    .select("id");
  if (error !== null && error !== undefined) return { ok: false, failed: ["claim"], notifyFailed: [] };
  if (!Array.isArray(claimed) || claimed.length === 0) return { ok: false, failed: ["not_auto_dismissed"], notifyFailed: [] };

  const applied = await applyReportDecision(svc, {
    reportId: args.reportId,
    targetType: args.targetType,
    targetRef: args.targetRef,
    targetUserId: args.targetUserId,
    reporterId: args.reporterId,
    reasonCode: args.reasonCode,
    placeName: args.placeName ?? null,
    decision: "actioned",
    note: args.note,
  });
  if (!applied.ok) {
    await svc.from("cheers_reports").update({ status: "dismissed", decided_by: null })
      .eq("id", args.reportId).eq("status", "actioned");
    return applied;
  }
  const notifyFailed = [...applied.notifyFailed];
  try {
    const { data: rows, error: readErr } = await svc
      .from("notifications")
      .select("id,payload")
      .eq("user_id", args.reporterId)
      .eq("kind", "report_resolved")
      .eq("payload->>report_id", args.reportId)
      .limit(1);
    const row = Array.isArray(rows) ? (rows[0] as { id?: unknown; payload?: unknown } | undefined) : undefined;
    if (readErr !== null && readErr !== undefined) {
      notifyFailed.push("reporter");
    } else if (row !== undefined && typeof row.id === "string") {
      const payload = { ...((row.payload ?? {}) as Record<string, unknown>), decision: "actioned", note: args.note.slice(0, 200), updated: true };
      const { error: upErr } = await svc
        .from("notifications")
        .update({ payload, read_at: null, created_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr !== null && upErr !== undefined) notifyFailed.push("reporter");
    }
  } catch {
    notifyFailed.push("reporter");
  }
  if (notifyFailed.includes("reporter")) {
    console.error(`[reportStp] [needs-repair] override notify reporter report=${args.reportId}`);
  }
  return { ok: true, failed: [], notifyFailed: [...new Set(notifyFailed)] };
}
