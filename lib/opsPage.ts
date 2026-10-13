import { notFound, redirect } from "next/navigation";

import { adminGate } from "./ops";

/** 只放行 /innerharbour/ 下的站內路徑（防 open redirect）。 */
export function safeOpsNext(raw: unknown): string {
  if (typeof raw === "string" && raw.startsWith("/innerharbour/") && !raw.includes("//") && !raw.includes("\\")) {
    return raw;
  }
  return "/innerharbour/review";
}

/**
 * 頁面／Server Action 共用門禁：
 * 非管理員／無會話 → 404；已是管理員但缺 MFA／step-up → 引導去 MFA 頁；viewer 寫操作 → 404。
 */
export async function requireAdminPage(
  opts: { write?: boolean; stepUp?: boolean },
  next: string,
): Promise<{ userId: string; role: "viewer" | "moderator"; svc: Awaited<ReturnType<typeof import("./supabase/server").createServiceClient>> }> {
  const g = await adminGate(opts);
  if (g.ok) return { userId: g.userId, role: g.role, svc: g.svc };
  if (g.reason === "need_mfa" || g.reason === "need_stepup") {
    redirect(`/innerharbour/mfa?next=${encodeURIComponent(safeOpsNext(next))}`);
  }
  notFound();
}
