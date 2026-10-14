/**
 * 投诉判定执行（后台人工／未来自动统一入口）。审核报告 2026-10-13 修复 H1／H2／H3／M1／M2：
 * - 状态机：只允许 `escalated`（含 appeal_status='pending' 的申诉案）被判；其余一律 invalid_state；
 * - 判定锁：条件更新抢锁（status／appeal_status 不变＋锁未被占用），并发第二个直接 busy；
 * - 改判（申诉）：原判不同 → 先按固定 ref 沖销原扣分（唯一键保证只沖一次）→ 再以新版本 ref 执行新判；
 *   与原判相同＝维持原判（不动积分）；
 * - 对外理由只用枚举 key（PUBLIC_REASONS），管理员内部备注永不进用户通知／用户 API；
 * - 每步幂等（trust_events 唯一 (kind, ref_id)）；失败释放锁，可重试。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { TRUST_CONFIG } from "./trust/config";
import { writeTrustEvent } from "./trust/ledger";

export type Decision = "uphold" | "dismiss" | "malicious";

/** 对外理由（用户可见；管理员只能从这里选，不能写自由文本）。 */
export const PUBLIC_REASONS = {
  evidence_confirmed: "經核實，投訴情況屬實",
  insufficient_evidence: "證據不足，暫不成立",
  contradicted_by_records: "系統記錄與投訴說明不符",
  guideline_violation: "違反社區守則",
  not_factual: "經審核，此投訴與事實不符",
  appeal_maintained: "申訴後維持原判",
  appeal_revised: "申訴後改判",
  system: "系統判定",
} as const;
export type PublicReasonKey = keyof typeof PUBLIC_REASONS;

export function isPublicReasonKey(v: unknown): v is PublicReasonKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PUBLIC_REASONS, v);
}

/** 用户 API／通知用：未知或空值回空串，不外泄任何自由文本。 */
export function publicReasonText(key: unknown): string {
  return isPublicReasonKey(key) ? PUBLIC_REASONS[key] : "";
}

export const PDPO_NOTE = "此結果由系統輔助判定並經人工審核，你有權在 7 天內申訴。";

const LOCK_MS = 2 * 60_000;

const TERMINAL_OF: Record<Decision, "upheld" | "dismissed" | "malicious"> = {
  uphold: "upheld",
  dismiss: "dismissed",
  malicious: "malicious",
};

export function decisionOfStatus(status: unknown): Decision | null {
  if (status === "upheld") return "uphold";
  if (status === "dismissed") return "dismiss";
  if (status === "malicious") return "malicious";
  return null;
}

/** ref_id：rev 0 保持历史格式；改判版本带 :r{n} 后缀（避免与已沖销的原事件撞唯一键）。 */
export function decisionRef(complaintId: string, decision: Decision, rev: number): string {
  return `complaint:${complaintId}:${decision}${rev > 0 ? `:r${rev}` : ""}`;
}

export type DecideOpts = {
  severity?: number;
  /** 管理员内部备注（仅后台可见）。 */
  internalNote?: string;
  publicReason: PublicReasonKey;
  /** `human:<adminId>`／`ai`。 */
  by: string;
};

export type DecideResult =
  | { ok: true; outcome: "decided" | "maintained" }
  | { ok: false; error: "not_found" | "invalid_state" | "busy" | "failed" };

/** 沖销一条已写的扣分（固定 ref → 重复调用只沖一次；原事件不存在即无事）。 */
export async function reverseTrustEvent(
  svc: SupabaseClient,
  originalRef: string,
  nowMs: number,
): Promise<void> {
  const { data } = await svc
    .from("trust_events")
    .select("user_id,kind,delta,party_id,expires_at")
    .eq("ref_id", originalRef)
    .maybeSingle();
  const row = data as {
    user_id?: unknown;
    kind?: unknown;
    delta?: unknown;
    party_id?: unknown;
    expires_at?: unknown;
  } | null;
  if (row === null || typeof row.user_id !== "string" || typeof row.delta !== "number" || row.delta === 0) {
    return;
  }
  const { error } = await svc.from("trust_events").insert({
    user_id: row.user_id,
    kind: typeof row.kind === "string" ? `${row.kind}:reversed` : "reversed",
    delta: -row.delta,
    party_id: typeof row.party_id === "string" ? row.party_id : null,
    ref_id: `${originalRef}:reversed`,
    note: "申诉改判沖銷",
    expires_at: typeof row.expires_at === "string" ? row.expires_at : new Date(nowMs).toISOString(),
  });
  // 23505＝已沖过（幂等）；其它错误必须抛，避免「沖销失败却继续执行新判」。
  if (error !== null && error.code !== "23505") {
    throw new Error(`reverse failed: ${error.code}`);
  }
}

async function applyPenalty(
  svc: SupabaseClient,
  c: Record<string, unknown>,
  decision: Decision,
  rev: number,
  opts: DecideOpts,
  nowMs: number,
): Promise<void> {
  const id = c.id as string;
  const targetId = c.target_id as string;
  const filerId = c.filer_id as string;
  const partyId = (c.party_id as string) ?? null;
  const category = c.category as string;
  const ref = decisionRef(id, decision, rev);
  if (decision === "uphold") {
    let delta: number = TRUST_CONFIG.upheld_other_delta;
    let expires = 90;
    let kind = "complaint_upheld";
    if (category === "no_show") {
      const { data: party } = await svc.from("parties").select("host_user_id").eq("id", partyId).maybeSingle();
      const isHost = (party as { host_user_id?: unknown } | null)?.host_user_id === targetId;
      delta = isHost ? TRUST_CONFIG.no_show_delta_host : TRUST_CONFIG.no_show_delta_member;
      expires = TRUST_CONFIG.expires_no_show_days;
      kind = "no_show";
    } else if (category === "mismatch") {
      delta = TRUST_CONFIG.upheld_mismatch_delta;
      expires = TRUST_CONFIG.expires_mismatch_days;
    } else if (category === "harassment") {
      const sev = opts.severity === 3 ? 3 : opts.severity === 2 ? 2 : 1;
      delta = sev === 3 ? TRUST_CONFIG.upheld_harassment_lv3 : sev === 2 ? TRUST_CONFIG.upheld_harassment_lv2 : TRUST_CONFIG.upheld_harassment_lv1;
      expires = TRUST_CONFIG.expires_harassment_days;
      kind = "harassment_upheld";
    }
    const r = await writeTrustEvent(svc, { user_id: targetId, kind, delta, party_id: partyId, ref_id: ref, expires_days: expires }, nowMs);
    if (r.reason === "db-error") throw new Error("trust write failed");
    return;
  }
  if (decision === "dismiss") {
    const r = await writeTrustEvent(svc, {
      user_id: filerId, kind: "complaint_dismissed", delta: TRUST_CONFIG.dismissed_filer_delta,
      party_id: partyId, ref_id: ref, expires_days: TRUST_CONFIG.expires_dismissed_days,
    }, nowMs);
    if (r.reason === "db-error") throw new Error("trust write failed");
    return;
  }
  const r = await writeTrustEvent(svc, {
    user_id: filerId, kind: "complaint_malicious", delta: TRUST_CONFIG.malicious_delta,
    party_id: partyId, ref_id: ref, expires_days: TRUST_CONFIG.expires_malicious_days,
  }, nowMs);
  if (r.reason === "db-error") throw new Error("trust write failed");
  const { error } = await svc.from("users").update({
    complaint_suspended_until: new Date(nowMs + TRUST_CONFIG.suspend_days * 24 * 3600_000).toISOString(),
  }).eq("id", filerId);
  if (error !== null) throw new Error("suspend failed");
}

async function releaseLock(svc: SupabaseClient, id: string, stamp: string): Promise<void> {
  await svc.from("complaints").update({ decision_lock_at: null }).eq("id", id).eq("decision_lock_at", stamp);
}

/**
 * 执行判定。成功＝状态机推进＋积分写入＋通知；非法状态／并发／失败都有明确错误码，调用方据此提示。
 */
export async function decideComplaint(
  svc: SupabaseClient,
  complaintId: string,
  decision: Decision,
  opts: DecideOpts,
  nowMs: number = Date.now(),
): Promise<DecideResult> {
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", complaintId).maybeSingle();
  const c = cRaw as Record<string, unknown> | null;
  if (c === null) return { ok: false, error: "not_found" };
  const isAppeal = c.status === "escalated" && c.appeal_status === "pending";
  const isFirst = c.status === "escalated" && c.appeal_status !== "pending";
  if (!isAppeal && !isFirst) return { ok: false, error: "invalid_state" };
  const prev: Decision | null = typeof c.decision === "string" && ["uphold", "dismiss", "malicious"].includes(c.decision)
    ? (c.decision as Decision)
    : null;
  const prevRev = typeof c.decision_rev === "number" ? c.decision_rev : 0;
  // 申诉案必须有原判可比；缺原判属数据异常，不执行。
  if (isAppeal && prev === null) return { ok: false, error: "invalid_state" };

  // 抢锁：状态与申诉态不变＋锁空闲／已过期；更新行数为 0＝别人正在判或状态已变。
  const stamp = new Date(nowMs).toISOString();
  const staleBefore = new Date(nowMs - LOCK_MS).toISOString();
  let claimQ = svc
    .from("complaints")
    .update({ decision_lock_at: stamp })
    .eq("id", complaintId)
    .eq("status", "escalated");
  claimQ = isAppeal ? claimQ.eq("appeal_status", "pending") : claimQ.or("appeal_status.is.null,appeal_status.neq.pending");
  const { data: claimed, error: claimErr } = await claimQ
    .or(`decision_lock_at.is.null,decision_lock_at.lt.${staleBefore}`)
    .select("id");
  if (claimErr !== null) return { ok: false, error: "failed" };
  if (!Array.isArray(claimed) || claimed.length === 0) return { ok: false, error: "busy" };

  try {
    let newRev = prevRev;
    let outcome: "decided" | "maintained" = "decided";
    let finalDecision: Decision = decision;
    let appealStatus: string | null = (c.appeal_status as string | null) ?? null;
    let reason: PublicReasonKey = opts.publicReason;
    if (isAppeal && prev !== null) {
      if (decision === prev) {
        // 维持原判：不动积分。
        outcome = "maintained";
        finalDecision = prev;
        appealStatus = "dismissed";
        reason = "appeal_maintained";
      } else {
        await reverseTrustEvent(svc, decisionRef(complaintId, prev, prevRev), nowMs);
        newRev = prevRev + 1;
        await applyPenalty(svc, c, decision, newRev, opts, nowMs);
        appealStatus = "upheld";
        reason = opts.publicReason === "system" ? "appeal_revised" : opts.publicReason;
      }
    } else {
      await applyPenalty(svc, c, decision, 0, opts, nowMs);
    }
    // 终态落库：仍以锁戳为条件，防止被抢锁后覆盖。
    const { data: done, error: doneErr } = await svc
      .from("complaints")
      .update({
        status: TERMINAL_OF[finalDecision],
        decision: finalDecision,
        decided_by: opts.by,
        internal_note: (opts.internalNote ?? "").slice(0, 500) || null,
        public_reason: reason,
        decided_at: new Date(nowMs).toISOString(),
        decision_rev: newRev,
        appeal_status: appealStatus,
        decision_lock_at: null,
      })
      .eq("id", complaintId)
      .eq("decision_lock_at", stamp)
      .select("id");
    if (doneErr !== null || !Array.isArray(done) || done.length === 0) {
      throw new Error("finalize failed");
    }
    await notifyResult(svc, c, finalDecision, reason, outcome === "maintained");
    if (finalDecision === "dismiss") await maybeSuspendFiler(svc, c.filer_id as string, nowMs);
    // 安全告警签收（有则）。
    await svc.from("safety_alerts").update({ handled_at: new Date(nowMs).toISOString() }).eq("complaint_id", complaintId).is("handled_at", null);
    return { ok: true, outcome };
  } catch (err) {
    console.error(`[complaints] decide failed: ${err instanceof Error ? err.message : "unknown"}`);
    await releaseLock(svc, complaintId, stamp);
    return { ok: false, error: "failed" };
  }
}

async function maybeSuspendFiler(svc: SupabaseClient, filerId: string, nowMs: number): Promise<void> {
  const since = new Date(nowMs - TRUST_CONFIG.dismissed_suspend_window_days * 24 * 3600_000).toISOString();
  const { data: dismissed } = await svc
    .from("complaints")
    .select("id")
    .eq("filer_id", filerId)
    .eq("status", "dismissed")
    .gte("decided_at", since)
    .limit(10);
  if (Array.isArray(dismissed) && dismissed.length >= TRUST_CONFIG.dismissed_suspend_count) {
    await svc.from("users").update({
      complaint_suspended_until: new Date(nowMs + TRUST_CONFIG.suspend_days * 24 * 3600_000).toISOString(),
    }).eq("id", filerId);
  }
}

async function notifyResult(
  svc: SupabaseClient,
  c: Record<string, unknown>,
  decision: Decision,
  reason: PublicReasonKey,
  maintained: boolean,
): Promise<void> {
  const partyId = (c.party_id as string) ?? null;
  const label = decision === "uphold" ? "upheld" : decision === "dismiss" ? "dismissed" : "malicious";
  const note = `${PUBLIC_REASONS[reason]}。${PDPO_NOTE}`;
  const rows = [
    { user_id: c.filer_id as string, kind: "complaint_result", party_id: partyId, actor_id: null,
      payload: { complaint_id: c.id, decision: label, note, appeal: maintained ? "maintained" : undefined } },
  ];
  // 被投诉人：惡意／駁回對其有利或中性，也告知結果；理由同一枚举文案（不含任何自由文本）。
  rows.push({ user_id: c.target_id as string, kind: "complaint_result", party_id: partyId, actor_id: null,
    payload: { complaint_id: c.id, decision: label, note, appeal: maintained ? "maintained" : undefined } });
  const { error } = await svc.from("notifications").insert(rows);
  if (error !== null) console.error(`[complaints] notify error: code=${error.code}`);
}

/**
 * UR H.2 游戏禁玩（admin 后台用；service 写 users.game_banned_until）。
 * 放 lib 而非 page：purity 规则只查组件文件，时间戳在此取。
 */
export async function banGameUser(
  svc: import("@supabase/supabase-js").SupabaseClient,
  targetId: string,
  days: number,
): Promise<void> {
  if (!Number.isFinite(days) || days <= 0 || days > 365) return;
  await svc
    .from("users")
    .update({ game_banned_until: new Date(Date.now() + days * 86400_000).toISOString() })
    .eq("id", targetId);
}
