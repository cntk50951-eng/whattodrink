/**
 * UR E.31 C1 结算（纯判定＋DB 落子；触发点在 attendance 读写 touch 时，懒结算无 cron）。
 * - outcome 判定纯函数 `decideOutcome`（可单测）：arrived／host 标记／是否在名单。
 * - `settleParty` 幂等（settled_at 非空跳过；dry-run 只记 outcome 不写账本）。
 * - 放鸽子候选：host 标未到＋无打卡＋无异议投诉 → no_show；有异议（同局 no_show 投诉未 dismissed）→ 跳过（C2 建案）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { TRUST_CONFIG } from "./config";
import { writeTrustEvent } from "./ledger";

export type AttendanceMark = {
  arrived_at: string | null;
  host_marked: boolean | null;
};

export type SettleOutcome = "attended" | "no_show" | "left" | "cancelled";

/**
 * 成员 outcome（仍在 joins 才到这里；退席者在调用方直接记 left）。
 * attended＝到场打卡或 host 标到；no_show＝host 标未到且无打卡（异议由调用方判）；
 * 其余证据不足 null（不加不扣）。
 */
export function decideOutcome(mark: AttendanceMark): SettleOutcome | null {
  if (mark.arrived_at !== null || mark.host_marked === true) return "attended";
  if (mark.host_marked === false) return "no_show";
  return null;
}

/** 距离取整 50m（防反推精确位置；message 用）。 */
export function roundDistance50m(meters: number): number {
  if (!Number.isFinite(meters) || meters < 0) return 0;
  return Math.round(meters / 50) * 50;
}

type AttRow = {
  user_id: unknown;
  arrived_at: unknown;
  host_marked: unknown;
  settled_at: unknown;
};

/**
 * 结算一局（局结束 24h 后首次 touch 触发；已撤銷跳过）。
 * 回 {settled, outcomes}（dry-run：outcome 照写、settled_at 照写？不——dry-run 不写 settled_at，
 * 以便之后真跑；outcome 写，供观察对照）。
 */
export async function settleParty(
  svc: SupabaseClient,
  partyId: string,
  nowMs: number,
): Promise<{ settled: boolean; outcomes: Record<string, string | null> }> {
  const { data: party } = await svc
    .from("parties")
    .select("id,host_user_id,status,expires_at")
    .eq("id", partyId)
    .maybeSingle();
  const p = party as { id?: unknown; host_user_id?: unknown; status?: unknown; expires_at?: unknown } | null;
  if (p === null || typeof p.id !== "string") return { settled: false, outcomes: {} };
  if (p.status === "cancelled") return { settled: false, outcomes: {} };
  const expiresMs = typeof p.expires_at === "string" ? Date.parse(p.expires_at) : NaN;
  if (!Number.isFinite(expiresMs) || nowMs < expiresMs + TRUST_CONFIG.attendance_window_h * 3600_000) {
    return { settled: false, outcomes: {} };
  }
  const hostId = typeof p.host_user_id === "string" ? p.host_user_id : "";
  const { data: joinRows } = await svc.from("joins").select("user_id").eq("party_id", partyId).limit(500);
  const joiners = new Set(
    ((joinRows ?? []) as unknown[]).map((j) => (j as { user_id?: unknown }).user_id).filter((id): id is string => typeof id === "string"),
  );
  const { data: attRows } = await svc
    .from("party_attendance")
    .select("user_id,arrived_at,host_marked,settled_at")
    .eq("party_id", partyId);
  const attById = new Map<string, AttRow>();
  for (const r of ((attRows ?? []) as unknown[]) as AttRow[]) {
    if (typeof (r as { user_id?: unknown }).user_id !== "string") continue;
    attById.set((r as unknown as { user_id: string }).user_id, r);
  }
  // 幂等：任一行已结算即整局跳过（dry-run 不写 settled_at，故 dry-run 会重跑，重写同值无害）。
  for (const r of attById.values()) {
    const s = (r as { settled_at?: unknown }).settled_at;
    if (s !== null && s !== undefined) return { settled: true, outcomes: {} };
  }
  const dryRun = !TRUST_CONFIG.settle_write_ledger;
  const outcomes: Record<string, string | null> = {};
  let attendedCount = 0;
  for (const uid of joiners) {
    const mark = attById.get(uid);
    const outcome = mark === undefined ? null : decideOutcome({
      arrived_at: typeof mark.arrived_at === "string" ? mark.arrived_at : null,
      host_marked: typeof mark.host_marked === "boolean" ? mark.host_marked : null,
    });
    if (outcome === "attended") {
      attendedCount += 1;
      if (!dryRun) {
        await writeTrustEvent(
          svc,
          { user_id: uid, kind: "attend", delta: 2, party_id: partyId, ref_id: `attend:${partyId}:${uid}`, expires_days: 180, peer_id: hostId },
          nowMs,
        );
      }
    } else if (outcome === "no_show") {
      // 异议保护：同局涉该成员的 no_show 投诉未 dismissed → 跳过（C2 建案口）。
      const { data: disputes } = await svc
        .from("complaints")
        .select("id,status")
        .eq("party_id", partyId)
        .eq("category", "no_show")
        .or(`and(filer_id.eq.${uid},target_id.eq.${hostId}),and(filer_id.eq.${hostId},target_id.eq.${uid})`)
        .neq("status", "dismissed")
        .limit(1);
      if (Array.isArray(disputes) && disputes.length > 0) {
        outcomes[uid] = "no_show_disputed";
      } else if (!dryRun) {
        await writeTrustEvent(
          svc,
          { user_id: uid, kind: "no_show", delta: -10, party_id: partyId, ref_id: `noshow:${partyId}:${uid}`, expires_days: 180 },
          nowMs,
        );
        outcomes[uid] = "no_show";
      } else {
        outcomes[uid] = "no_show";
      }
    } else {
      outcomes[uid] = null;
    }
    await svc.from("party_attendance").upsert(
      {
        party_id: partyId,
        user_id: uid,
        settled_at: dryRun ? null : new Date(nowMs).toISOString(),
        outcome: outcomes[uid],
      },
      { onConflict: "party_id,user_id" },
    );
  }
  // 发起人成局（attended 成员 ≥2；配置 min_members 取小——min_members≥2 恒成立，阈值即 2）。
  if (attendedCount >= 2 && !dryRun && hostId !== "") {
    await writeTrustEvent(
      svc,
      { user_id: hostId, kind: "hosted_completed", delta: 3, party_id: partyId, ref_id: `hosted:${partyId}`, expires_days: 180 },
      nowMs,
    );
  }
  // 发起人放鸽子候选：≥2 名成员标 host 未到＋发起人无打卡（有异议投诉即跳过，逻辑同成员）。
  if (!dryRun && hostId !== "") {
    const { data: hostAtt } = await svc
      .from("party_attendance")
      .select("arrived_at")
      .eq("party_id", partyId)
      .eq("user_id", hostId)
      .maybeSingle();
    const hostArrived = typeof (hostAtt as { arrived_at?: unknown } | null)?.arrived_at === "string";
    const { data: absentMarks } = await svc
      .from("party_attendance")
      .select("user_id")
      .eq("party_id", partyId)
      .eq("self_host_attended", false)
      .limit(500);
    const absentCount = ((absentMarks ?? []) as unknown[]).length;
    if (!hostArrived && absentCount >= 2) {
      const { data: disputes } = await svc
        .from("complaints")
        .select("id,status")
        .eq("party_id", partyId)
        .eq("category", "no_show")
        .neq("status", "dismissed")
        .limit(1);
      if (!Array.isArray(disputes) || disputes.length === 0) {
        await writeTrustEvent(
          svc,
          { user_id: hostId, kind: "no_show", delta: -15, party_id: partyId, ref_id: `noshow:${partyId}:${hostId}`, expires_days: 180 },
          nowMs,
        );
      }
    }
  }
  // host 行也落 settled（无 outcome 概念，记 attended 供计数一致）。
  if (hostId !== "") {
    await svc.from("party_attendance").upsert(
      { party_id: partyId, user_id: hostId, settled_at: dryRun ? null : new Date(nowMs).toISOString(), outcome: "attended" },
      { onConflict: "party_id,user_id" },
    );
  }
  return { settled: !dryRun, outcomes };
}

/** 完成率（分母＝近 90 天已结算自办局，分子＝成局；C1 现算，填 B 预留 null）。 */
export async function completionRate(
  svc: SupabaseClient,
  userId: string,
  nowMs: number,
): Promise<number | null> {
  const since90 = new Date(nowMs - 90 * 24 * 3600_000).toISOString();
  const { data: mine } = await svc
    .from("parties")
    .select("id,expires_at,status")
    .eq("host_user_id", userId)
    .eq("status", "open")
    .gte("created_at", since90)
    .limit(200);
  const settled = (((mine ?? []) as unknown[]) as { id?: unknown; expires_at?: unknown }[]).filter(
    (p) => typeof p.id === "string" && typeof p.expires_at === "string" && Date.parse(p.expires_at) + 24 * 3600_000 <= nowMs,
  );
  if (settled.length === 0) return null;
  const ids = settled.map((p) => p.id as string);
  const { data: atts } = await svc
    .from("party_attendance")
    .select("party_id,outcome,user_id")
    .in("party_id", ids)
    .eq("outcome", "attended")
    .limit(2000);
  // 成局口径与结算一致：attended 成员 ≥2。
  const counts = new Map<string, number>();
  for (const a of ((atts ?? []) as unknown[]) as { party_id?: unknown; user_id?: unknown }[]) {
    if (typeof a.party_id !== "string" || typeof a.user_id !== "string" || a.user_id === userId) continue;
    counts.set(a.party_id, (counts.get(a.party_id) ?? 0) + 1);
  }
  let made = 0;
  for (const p of settled) {
    if ((counts.get(p.id as string) ?? 0) >= 2) made += 1;
  }
  return Math.round((made / settled.length) * 100) / 100;
}
