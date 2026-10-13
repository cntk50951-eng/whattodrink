import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { computeTrust, trustTier } from "@/lib/trust/score";

/**
 * UR E.30 他人诚信（🔒，不回精确分）。
 * `GET /api/v1/users/:id/trust` —— `{tier, completed_count, hosted_count,
 * completion_rate, cancel_90d}`。拉黑任一方向 404；completion_rate 本期 null
 * （出席确认 C 阶段才有口径，占位）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64 || id === userId) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const svc = await createServiceClient();
  const { data: target } = await svc.from("users").select("id").eq("id", id).maybeSingle();
  if (target === null) return apiError("not_found", "用户不存在", 404);
  const { data: blockRows } = await svc
    .from("cheers_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${userId})`)
    .limit(1);
  if (Array.isArray(blockRows) && blockRows.length > 0) {
    return apiError("not_found", "用户不存在", 404);
  }
  const nowMs = Date.now();
  const { data: rows } = await svc
    .from("trust_events")
    .select("kind,delta,created_at,expires_at")
    .eq("user_id", id)
    .limit(2000);
  const ledger = ((rows ?? []) as unknown[]) as {
    kind: unknown;
    delta: unknown;
    created_at: unknown;
    expires_at: unknown;
  }[];
  const { score, completed } = computeTrust(ledger, nowMs);
  const since90 = new Date(nowMs - 90 * 24 * 3600_000).toISOString();
  const [{ count: hostedCount }, { data: ev90 }] = await Promise.all([
    svc.from("parties").select("id", { count: "exact", head: true }).eq("host_user_id", id),
    svc.from("party_events").select("kind").eq("user_id", id).gte("created_at", since90).limit(2000),
  ]);
  let cancel90d = 0;
  for (const e of ((ev90 ?? []) as unknown[]) as { kind?: unknown }[]) {
    if (e.kind === "cancel") cancel90d += 1;
  }
  return apiOk({
    tier: trustTier(score, completed),
    completed_count: completed,
    hosted_count: hostedCount ?? 0,
    completion_rate: null,
    cancel_90d: cancel90d,
  });
}
