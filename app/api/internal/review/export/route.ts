import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/envelope";
import { cookieSessionUserId, logAdmin, requireAdmin } from "@/lib/ops";

/**
 * 內部審核導出 CSV（UR E.31 C2；白名單，非管理員 404）。
 * `GET /api/internal/review/export?month=YYYY-MM` —— 当月案件（id,category,status,decision,filer,target,created,decided）。
 */
export async function GET(req: Request): Promise<Response> {
  // 清單 A3：只認 cookie 會話。
  const userId = await cookieSessionUserId();
  if (userId === null) {
    return apiError("not_found", "不存在", 404);
  }
  const svc = await createServiceClient();
  if (!(await requireAdmin(svc, userId))) {
    return apiError("not_found", "不存在", 404);
  }
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return apiError("invalid_params", "month 只要 YYYY-MM", 400);
  }
  const { data: rows } = await svc
    .from("complaints")
    .select("id,category,status,decision,filer_id,target_id,created_at,decided_at")
    .gte("created_at", `${month}-01T00:00:00Z`)
    .order("created_at", { ascending: true })
    .limit(5000);
  const end = new Date(`${month}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const list = (((rows ?? []) as unknown[]) as Record<string, unknown>[]).filter((r) => {
    const c = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
    return Number.isFinite(c) && c < end.getTime();
  });
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    "id,category,status,decision,filer_id,target_id,created_at,decided_at",
    ...list.map((r) =>
      [r.id, r.category, r.status, r.decision, r.filer_id, r.target_id, r.created_at, r.decided_at].map(esc).join(","),
    ),
  ].join("\n");
  await logAdmin(svc, { admin_id: userId, action: "export_csv", target: month, detail: { rows: list.length } });
  return new Response(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="complaints-${month}.csv"` },
  });
}
