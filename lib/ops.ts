/**
 * 內部審核後台門禁（UR E.31 C2；2026-10-13 安全審核加固）。
 * - 路徑隱蔽只是添頭；真正靠 `adminGate`：只認 cookie 會話（Bearer 無效）→ admins 表（含角色）→
 *   TOTP（aal2）→ 寫操作／導出另要「新鮮 TOTP」（step-up）。
 * - 非管理員一律 404（調用方 notFound）；已是管理員但缺 MFA／step-up 才引導到 /innerharbour/mfa。
 * - 審計「先寫後做」：`auditOrThrow` 失敗即中止操作（審計不寫＝不能做）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const OPS_BASE = "innerharbour";

export type AdminRole = "viewer" | "moderator";

export type AdminGate =
  | { ok: true; userId: string; role: AdminRole; svc: SupabaseClient }
  /** none＝非管理員／無會話（一律 404）；其餘＝已確認是管理員，需引導或拒絕。 */
  | { ok: false; reason: "none" | "need_mfa" | "need_stepup" | "forbidden_role" };

/** MFA 默認必須；僅在明確設為 "false"（本地開發）時關閉。 */
export function mfaRequired(env: string | undefined = process.env.ADMIN_MFA_REQUIRED): boolean {
  return env !== "false";
}

/** step-up 窗口（分鐘）：默認 15。 */
export function stepUpWindowMs(env: string | undefined = process.env.ADMIN_STEPUP_MINUTES): number {
  const n = Number(env);
  return (Number.isFinite(n) && n >= 1 && n <= 240 ? n : 15) * 60_000;
}

type ClaimsLike = { aal?: unknown; amr?: unknown } | null | undefined;

/** 最近一次 TOTP 驗證是否在窗口內（amr[].timestamp 為秒）。純函數可測。 */
export function isFreshMfa(claims: ClaimsLike, nowMs: number, windowMs: number): boolean {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;
  let latest = 0;
  for (const m of amr as unknown[]) {
    const rec = (typeof m === "object" && m !== null ? m : {}) as { method?: unknown; timestamp?: unknown };
    if (rec.method === "totp" && typeof rec.timestamp === "number" && rec.timestamp > latest) {
      latest = rec.timestamp;
    }
  }
  return latest > 0 && nowMs - latest * 1000 <= windowMs;
}

export async function adminGate(
  opts: { write?: boolean; stepUp?: boolean; skipMfa?: boolean } = {},
): Promise<AdminGate> {
  const { createClient, createServiceClient } = await import("./supabase/server");
  // 只用 cookie client（Bearer 頭一律無視：iOS／腳本令牌到此即止）。
  const supa = await createClient();
  const { data } = await supa.auth.getClaims();
  const claims = (data?.claims ?? null) as (ClaimsLike & { sub?: unknown }) | null;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (userId === null) return { ok: false, reason: "none" };
  const svc = await createServiceClient();
  const { data: row } = await svc.from("admins").select("user_id,role").eq("user_id", userId).maybeSingle();
  if (row === null) return { ok: false, reason: "none" };
  const role: AdminRole = (row as { role?: unknown }).role === "viewer" ? "viewer" : "moderator";
  if (!opts.skipMfa && mfaRequired() && claims?.aal !== "aal2") {
    return { ok: false, reason: "need_mfa" };
  }
  if (opts.write && role === "viewer") return { ok: false, reason: "forbidden_role" };
  if (opts.stepUp && mfaRequired() && !isFreshMfa(claims, Date.now(), stepUpWindowMs())) {
    return { ok: false, reason: "need_stepup" };
  }
  return { ok: true, userId, role, svc };
}

/** 同源校驗（寫操作防 CSRF；Origin 缺席即拒）。 */
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

async function clientMeta(): Promise<{ ip: string | null; ua: string }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      ua: (h.get("user-agent") ?? "").slice(0, 300),
    };
  } catch {
    return { ip: null, ua: "" };
  }
}

export type AuditEntry = {
  admin_id: string;
  action: string;
  target: string;
  detail?: Record<string, unknown>;
};

/** 審計（阻斷版）：寫失敗即拋，調用方不得繼續執行敏感操作。 */
export async function auditOrThrow(svc: SupabaseClient, entry: AuditEntry): Promise<void> {
  const meta = await clientMeta();
  const { error } = await svc.from("admin_audit_log").insert({
    admin_id: entry.admin_id,
    action: entry.action,
    target: entry.target,
    detail: entry.detail ?? {},
    ip: meta.ip,
    ua: meta.ua,
  });
  if (error !== null) {
    console.error(`[ops] audit error: code=${error.code} message=${error.message}`);
    throw new Error("審計寫入失敗，操作已中止");
  }
}

/** 審計（盡力版）：只給「結果補記」用；主操作的意圖記錄必須走 auditOrThrow。 */
export async function logAdmin(svc: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await auditOrThrow(svc, entry);
  } catch {
    /* 已在 auditOrThrow 記紅字 */
  }
}

/** 查看詳情審計：同一管理員同一目標 60 秒內只記一次（防刷新噪音）；寫失敗阻斷（看敏感內容也要留痕）。 */
export async function auditViewOnce(svc: SupabaseClient, entry: AuditEntry): Promise<void> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await svc
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", entry.admin_id)
    .eq("action", entry.action)
    .eq("target", entry.target)
    .gte("at", since);
  if ((count ?? 0) > 0) return;
  await auditOrThrow(svc, entry);
}

/** 管理員寫操作限速：窗口內同類審計條數 ≥ max 即拒。 */
export async function adminRateLimited(
  svc: SupabaseClient,
  adminId: string,
  actions: string[],
  max: number,
  windowMs: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await svc
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .in("action", actions)
    .gte("at", since);
  return (count ?? 0) >= max;
}
