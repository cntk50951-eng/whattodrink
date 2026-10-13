import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { TRUST_CONFIG, TRUST_KIND_TEXT } from "@/lib/trust/config";
import { computeTrust, trustTier } from "@/lib/trust/score";

/**
 * UR E.30 本人诚信（🔒）。
 * `GET /me/trust?limit=&cursor=` —— `{score, tier, completed_count, hosted_count,
 * cancel_90d, leave_late_90d, restricted_until, ledger}`（账本倒序，keyset cursor＝created_at，
 * limit 1–50 默认 20；ledger 行含有效分量 `effective_delta`）。
 * `restricted_until`：tier restricted 即 now＋14d（滚动），否则 null。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const q = new URL(req.url).searchParams;
  const limitRaw = Number(q.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 20;
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: rows } = await svc
    .from("trust_events")
    .select("id,kind,delta,party_id,note,created_at,expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000);
  const ledger = ((rows ?? []) as unknown[]) as {
    id: unknown;
    kind: unknown;
    delta: unknown;
    party_id: unknown;
    created_at: unknown;
    expires_at: unknown;
  }[];
  const { score, completed } = computeTrust(ledger, nowMs);
  const tier = trustTier(score, completed);
  // hosted／cancel_90d／leave_late_90d（party_events 按 kind 聚）。
  const since90 = new Date(nowMs - 90 * 24 * 3600_000).toISOString();
  const [{ count: hostedCount }, { data: ev90 }] = await Promise.all([
    svc.from("parties").select("id", { count: "exact", head: true }).eq("host_user_id", userId),
    svc.from("party_events").select("kind").eq("user_id", userId).gte("created_at", since90).limit(2000),
  ]);
  let cancel90d = 0;
  let leaveLate90d = 0;
  for (const e of ((ev90 ?? []) as unknown[]) as { kind?: unknown }[]) {
    if (e.kind === "cancel") cancel90d += 1;
    if (e.kind === "leave_late") leaveLate90d += 1;
  }
  let page = ledger;
  if (Number.isFinite(cursorMs)) {
    page = ledger.filter((r) => {
      const c = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
      return Number.isFinite(c) && (c as number) < cursorMs;
    });
  }
  const slice = page.slice(0, limit + 1);
  const items = slice.slice(0, limit).map((r) => {
    const created = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
    const expires = typeof r.expires_at === "string" ? Date.parse(r.expires_at) : NaN;
    const delta = typeof r.delta === "number" ? r.delta : 0;
    const eff =
      Number.isFinite(created) && Number.isFinite(expires) && expires > created && nowMs < expires
        ? delta * (1 - (nowMs - (created as number)) / ((expires as number) - (created as number)))
        : 0;
    return {
      id: r.id,
      kind: r.kind,
      delta,
      effective_delta: Math.round(eff * 100) / 100,
      reason_text: null as string | null,
      party_id: typeof r.party_id === "string" ? r.party_id : null,
      created_at: r.created_at,
      expires_at: r.expires_at,
    };
  });
  // reason_text 按 kind 映射＋party_place 批量（展示用；iOS 不二次查询）。
  const partyIds = [
    ...new Set(
      items
        .map((it) => (it as Record<string, unknown>).party_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const placeById = new Map<string, string | null>();
  if (partyIds.length > 0) {
    const { data: partyRows } = await svc.from("parties").select("id,place").in("id", partyIds);
    for (const p of ((partyRows ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof p.id === "string") {
        placeById.set(p.id, typeof p.place === "string" ? p.place : null);
      }
    }
  }
  for (const it of items) {
    const rec = it as Record<string, unknown>;
    rec.reason_text = typeof it.kind === "string" ? (TRUST_KIND_TEXT[it.kind] ?? it.kind) : it.kind;
    rec.party_place =
      typeof rec.party_id === "string" ? (placeById.get(rec.party_id) ?? null) : null;
  }
  const nextCursor =
    slice.length > limit && items.length > 0
      ? ((items[items.length - 1] as Record<string, unknown>).created_at as string | null) ?? null
      : null;
  return apiOk({
    score,
    tier,
    completed_count: completed,
    hosted_count: hostedCount ?? 0,
    cancel_90d: cancel90d,
    leave_late_90d: leaveLate90d,
    restricted_until: tier === "restricted" ? new Date(nowMs + TRUST_CONFIG.restricted_days * 24 * 3600_000).toISOString() : null,
    ledger: items,
    nextCursor,
  });
}
