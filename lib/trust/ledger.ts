/**
 * UR E.30 賬本寫入（DB IO；纯算在 score.ts）。
 * - 同一事件只记一账：唯一 (kind, ref_id)，23505 即已记过（重试幂等）。
 * - 周上限／互刷递减／连击奖励在写时执行；救濟在读时生效（score.ts）。
 * - 通知阈值 |delta|≥3：写 `trust_changed`（payload 供 iOS 拼文案）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { TRUST_CONFIG, TRUST_KIND_TEXT } from "./config";
import { computeTrust, trustTier } from "./score";

const DAY_MS = 24 * 3600_000;

/** 加分组（周上限各算）：attend 系／hosted 系。 */
function capGroupOf(kind: string): "attend" | "hosted" | null {
  if (kind === "attend") return "attend";
  if (kind === "hosted_completed") return "hosted";
  return null;
}

async function sharedParties30d(
  svc: SupabaseClient,
  a: string,
  b: string,
  nowMs: number,
  excludePartyId: string | null,
): Promise<number> {
  const since = new Date(nowMs - TRUST_CONFIG.mutual_window_days * DAY_MS).toISOString();
  const [{ data: parties }, { data: joins }] = await Promise.all([
    svc.from("parties").select("id,host_user_id,created_at").gte("created_at", since).or(`host_user_id.eq.${a},host_user_id.eq.${b}`).limit(500),
    svc.from("joins").select("party_id,user_id").in("user_id", [a, b]).limit(2000),
  ]);
  const aSet = new Set<string>();
  const bSet = new Set<string>();
  for (const p of ((parties ?? []) as unknown[]) as { id?: unknown; host_user_id?: unknown }[]) {
    if (typeof p.id !== "string" || p.id === excludePartyId) continue;
    if (p.host_user_id === a) aSet.add(p.id);
    if (p.host_user_id === b) bSet.add(p.id);
  }
  for (const j of ((joins ?? []) as unknown[]) as { party_id?: unknown; user_id?: unknown }[]) {
    if (typeof j.party_id !== "string" || j.party_id === excludePartyId) continue;
    if (j.user_id === a) aSet.add(j.party_id);
    if (j.user_id === b) bSet.add(j.party_id);
  }
  let shared = 0;
  for (const id of aSet) {
    if (bSet.has(id)) shared += 1;
  }
  return shared;
}

export type WriteTrustArgs = {
  user_id: string;
  kind: string;
  delta: number;
  party_id?: string | null;
  ref_id: string;
  note?: string | null;
  expires_days?: number;
  /** 互刷判定对手（attend／hosted 系加分才需要；不给即不递减）。 */
  peer_id?: string | null;
};

export async function writeTrustEvent(
  svc: SupabaseClient,
  args: WriteTrustArgs,
  nowMs: number = Date.now(),
): Promise<{ written: boolean; effectiveDelta: number; reason: string }> {
  const reason = TRUST_KIND_TEXT[args.kind] ?? args.kind;
  let delta = args.delta;
  // 周上限（同组正分 7 天内累计 ≥6 即跳过）。
  const group = capGroupOf(args.kind);
  if (group !== null && delta > 0) {
    const since = new Date(nowMs - 7 * DAY_MS).toISOString();
    const kinds = group === "attend" ? ["attend"] : ["hosted_completed"];
    const { data } = await svc
      .from("trust_events")
      .select("delta")
      .eq("user_id", args.user_id)
      .in("kind", kinds)
      .gte("created_at", since)
      .limit(50);
    const acc = ((data ?? []) as unknown[]).reduce((s: number, r) => {
      const d = (r as { delta?: unknown }).delta;
      return s + (typeof d === "number" && d > 0 ? d : 0);
    }, 0);
    if (acc >= TRUST_CONFIG.weekly_bonus_cap) {
      return { written: false, effectiveDelta: 0, reason: "weekly-cap" };
    }
  }
  // 互刷递减（第 2 局 ×0.5，第 3 局起 0；四舍五入）。
  if (group !== null && delta > 0 && typeof args.peer_id === "string" && args.peer_id !== "") {
    const shared = await sharedParties30d(svc, args.user_id, args.peer_id, nowMs, args.party_id ?? null);
    if (shared >= 2) return { written: false, effectiveDelta: 0, reason: "mutual-capped" };
    if (shared >= 1) delta = Math.round(delta * 0.5);
    if (delta <= 0) return { written: false, effectiveDelta: 0, reason: "mutual-capped" };
  }
  const life = (args.expires_days ?? 90) * DAY_MS;
  const { error } = await svc.from("trust_events").insert({
    user_id: args.user_id,
    kind: args.kind,
    delta,
    party_id: args.party_id ?? null,
    ref_id: args.ref_id,
    note: args.note ?? null,
    expires_at: new Date(nowMs + life).toISOString(),
  });
  if (error !== null) {
    // 23505＝同一事件已记过（重试幂等），不算失败。
    if (error.code === "23505") return { written: false, effectiveDelta: 0, reason: "duplicate" };
    console.error(`[trust] write error: code=${error.code} message=${error.message}`);
    return { written: false, effectiveDelta: 0, reason: "db-error" };
  }
  // 连击奖励（90 天无违约＋累计 ≥5 完成＋90 天未领过）。
  if (group !== null && delta > 0) {
    await maybeStreakBonus(svc, args.user_id, nowMs);
  }
  // 通知（|delta|≥3；读现分拼 new_tier）。
  if (Math.abs(delta) >= TRUST_CONFIG.notify_threshold) {
    const t = await readTrust(svc, args.user_id, nowMs);
    await svc.from("notifications").insert({
      user_id: args.user_id,
      kind: "trust_changed",
      party_id: args.party_id ?? null,
      actor_id: null,
      payload: { delta, reason_text: reason, new_tier: t.tier },
    });
  }
  return { written: true, effectiveDelta: delta, reason };
}

async function maybeStreakBonus(
  svc: SupabaseClient,
  userId: string,
  nowMs: number,
): Promise<void> {
  const since90 = new Date(nowMs - TRUST_CONFIG.streak_bonus_cooldown_days * DAY_MS).toISOString();
  const { data } = await svc
    .from("trust_events")
    .select("kind,delta,created_at")
    .eq("user_id", userId)
    .gte("created_at", since90)
    .limit(200);
  const rows = ((data ?? []) as unknown[]) as { kind?: unknown; delta?: unknown; created_at?: unknown }[];
  if (rows.some((r) => typeof r.delta === "number" && r.delta < 0)) return;
  const { data: all } = await svc
    .from("trust_events")
    .select("kind,delta")
    .eq("user_id", userId)
    .in("kind", ["attend", "hosted_completed"])
    .limit(2000);
  const completed = ((all ?? []) as unknown[]).filter(
    (r) => typeof (r as { delta?: unknown }).delta === "number" && ((r as { delta: number }).delta ?? 0) > 0,
  ).length;
  if (completed < TRUST_CONFIG.streak_clean_days) return;
  if (rows.some((r) => r.kind === "streak_bonus")) return;
  await svc.from("trust_events").insert({
    user_id: userId,
    kind: "streak_bonus",
    delta: TRUST_CONFIG.streak_bonus,
    party_id: null,
    ref_id: `streak:${userId}:${new Date(nowMs).toISOString().slice(0, 10)}`,
    note: null,
    expires_at: new Date(nowMs + 180 * DAY_MS).toISOString(),
  });
}

export type TrustView = {
  score: number;
  tier: string;
  completed: number;
};

/** 现算视图（读；救濟在 computeTrust 内生效）。 */
export async function readTrust(
  svc: SupabaseClient,
  userId: string,
  nowMs: number = Date.now(),
): Promise<TrustView> {
  const { data } = await svc
    .from("trust_events")
    .select("kind,delta,created_at,expires_at")
    .eq("user_id", userId)
    .limit(2000);
  const rows = ((data ?? []) as unknown[]) as {
    kind: unknown;
    delta: unknown;
    created_at: unknown;
    expires_at: unknown;
  }[];
  const { score, completed } = computeTrust(rows, nowMs);
  return { score, tier: trustTier(score, completed), completed };
}

export type HostTrust = {
  tier: string;
  hosted_count: number;
  completion_rate: number | null;
  cancel_90d: number;
};

/**
 * 发起人徽章批量（列表 N+1 收敛：3 查询；completion_rate 本期 null，C 阶段填）。
 * cancel_90d 按 party_events kind= cancel 计。
 */
export async function hostTrustMap(
  svc: SupabaseClient,
  hostIds: string[],
  nowMs: number,
): Promise<Map<string, HostTrust>> {
  const out = new Map<string, HostTrust>();
  const ids = [...new Set(hostIds)].filter((id) => id !== "").slice(0, 500);
  if (ids.length === 0) return out;
  const since90 = new Date(nowMs - 90 * DAY_MS).toISOString();
  const [{ data: ledgers }, { data: hosted }, { data: cancels }] = await Promise.all([
    svc.from("trust_events").select("user_id,kind,delta,created_at,expires_at").in("user_id", ids).limit(5000),
    svc.from("parties").select("host_user_id").in("host_user_id", ids).limit(5000),
    svc.from("party_events").select("user_id").eq("kind", "cancel").in("user_id", ids).gte("created_at", since90).limit(5000),
  ]);
  const byUser = new Map<string, { kind: unknown; delta: unknown; created_at: unknown; expires_at: unknown }[]>();
  for (const r of ((ledgers ?? []) as unknown[]) as Record<string, unknown>[]) {
    if (typeof r.user_id !== "string") continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)?.push(r as { kind: unknown; delta: unknown; created_at: unknown; expires_at: unknown });
  }
  const hostedCount = new Map<string, number>();
  for (const p of ((hosted ?? []) as unknown[]) as { host_user_id?: unknown }[]) {
    if (typeof p.host_user_id !== "string") continue;
    hostedCount.set(p.host_user_id, (hostedCount.get(p.host_user_id) ?? 0) + 1);
  }
  const cancelCount = new Map<string, number>();
  for (const e of ((cancels ?? []) as unknown[]) as { user_id?: unknown }[]) {
    if (typeof e.user_id !== "string") continue;
    cancelCount.set(e.user_id, (cancelCount.get(e.user_id) ?? 0) + 1);
  }
  for (const id of ids) {
    const { score, completed } = computeTrust(byUser.get(id) ?? [], nowMs);
    out.set(id, {
      tier: trustTier(score, completed),
      hosted_count: hostedCount.get(id) ?? 0,
      completion_rate: null,
      cancel_90d: cancelCount.get(id) ?? 0,
    });
  }
  return out;
}
