/**
 * 內部審核後台門禁（UR E.31 C2）。
 * - 路徑不用 admin 关键字（防掃描只是添頭）；真正靠 requireAdmin 白名單，
 *   非管理員一律 404（不暴露存在）。
 * - OPS_BASE 由環境變量定（默認 innerharbour），輪換即改 env 重部署。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const OPS_BASE: string =
  typeof process.env.OPS_PATH === "string" && process.env.OPS_PATH !== ""
    ? process.env.OPS_PATH.replace(/^\/+|\/+$/g, "")
    : "innerharbour";

/** 是否管理员（admins 白名单表；service 读）。 */
export async function requireAdmin(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await svc.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return data !== null;
}

/**
 * 清單 A3：admin 只認 cookie 會話（Bearer 通道禁用）。
 * 用纯 cookie client 验 claims；Bearer 头直接无视（iOS 令牌到此即止）。
 */
export async function cookieSessionUserId(): Promise<string | null> {
  const { createClient } = await import("./supabase/server");
  const supa = await createClient();
  const { data } = await supa.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/** 同源校验（清單 B10：写操作防 CSRF；Origin 缺席即拒）。 */
export async function checkSameOrigin(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const origin = h.get("origin");
    const host = h.get("host") ?? h.get("x-forwarded-host") ?? "";
    if (origin === null || host === "") return false;
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return false;
    }
    return originHost === host;
  } catch {
    return false;
  }
}

/** 管理员审计落子（清單 D21；失败只记 console，不拦主操作——落子失败本身即告警信号）。 */
export async function logAdmin(
  svc: SupabaseClient,
  entry: {
    admin_id: string;
    action: string;
    target: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const { error } = await svc.from("admin_audit_log").insert({
      admin_id: entry.admin_id,
      action: entry.action,
      target: entry.target,
      detail: entry.detail ?? {},
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      ua: (h.get("user-agent") ?? "").slice(0, 300),
    });
    if (error !== null) {
      console.error(`[ops] audit error: code=${error.code} message=${error.message}`);
    }
  } catch (err) {
    console.error(`[ops] audit threw: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

/** 反向沖銷（申诉改判：原扣分先冲回，同 expires；审计保留两行）。 */
export async function reverseTrustEvent(
  svc: SupabaseClient,
  refId: string,
  nowMs: number,
): Promise<void> {
  const { data } = await svc
    .from("trust_events")
    .select("user_id,kind,delta,party_id,expires_at")
    .eq("ref_id", refId)
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
  await svc.from("trust_events").insert({
    user_id: row.user_id,
    kind: typeof row.kind === "string" ? `${row.kind}:reversed` : "reversed",
    delta: -row.delta,
    party_id: typeof row.party_id === "string" ? row.party_id : null,
    ref_id: `${refId}:reversed:${new Date(nowMs).toISOString().slice(0, 10)}`,
    note: "申诉改判沖銷",
    expires_at: typeof row.expires_at === "string" ? row.expires_at : new Date(nowMs).toISOString(),
  });
}
