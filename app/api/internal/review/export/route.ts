import { apiError } from "@/lib/api/envelope";
import { adminGate, adminRateLimited, auditOrThrow } from "@/lib/ops";

/**
 * 內部審核導出 CSV（UR E.31 C2；2026-10-13 加固）。
 * `GET /api/internal/review/export?month=YYYY-MM`
 * - 只認 cookie 會話；非管理員 404；viewer 不可導出；缺 MFA／step-up 回 403 mfa_required（只對管理員可見）；
 * - 先寫審計（失敗即中止）；限速 5 次／小時；欄位只有案件摘要，無 ai_json／flags／內部備註。
 */
export async function GET(req: Request): Promise<Response> {
  const g = await adminGate({ write: true, stepUp: true });
  if (!g.ok) {
    if (g.reason === "need_mfa" || g.reason === "need_stepup") {
      return apiError("mfa_required", "需要二次驗證", 403);
    }
    return apiError("not_found", "不存在", 404);
  }
  const { svc, userId } = g;
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return apiError("invalid_params", "month 只要 YYYY-MM", 400);
  }
  if (await adminRateLimited(svc, userId, ["export_csv"], 5, 3600_000)) {
    return apiError("rate_limited", "導出過於頻繁", 429);
  }
  try {
    await auditOrThrow(svc, { admin_id: userId, action: "export_csv", target: month });
  } catch {
    return apiError("internal", "審計寫入失敗，導出已中止", 500);
  }
  const end = new Date(`${month}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const { data: rows } = await svc
    .from("complaints")
    .select("id,category,status,decision,filer_id,target_id,created_at,decided_at")
    .gte("created_at", `${month}-01T00:00:00Z`)
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);
  const list = ((rows ?? []) as unknown[]) as Record<string, unknown>[];
  const esc = (v: unknown): string => {
    let s = v === null || v === undefined ? "" : String(v);
    // CSV 公式注入防護（以防將來加自由文本欄位）。
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    "id,category,status,decision,filer_id,target_id,created_at,decided_at",
    ...list.map((r) =>
      [r.id, r.category, r.status, r.decision, r.filer_id, r.target_id, r.created_at, r.decided_at].map(esc).join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="complaints-${month}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
