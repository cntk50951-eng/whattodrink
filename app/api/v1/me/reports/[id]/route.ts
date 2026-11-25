import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCheckinIdParam } from "@/lib/api/checkins";
import {
  MY_REPORT_COLUMNS,
  MY_REPORT_COLUMNS_LEGACY,
  loadMyReportTargets,
  toMyReportDetail,
  type MyReportRow,
} from "@/lib/api/myReports";

/**
 * 我的舉報詳情（🔒；openapi 1.71.0）。`GET /api/v1/me/reports/:id` → 列表欄位＋evidence（舉報當下的證據快照）＋timeline。
 * 不是自己提交的案件一律 404（不洩露存在）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const { id: rawId } = await params;
  const parsed = parseCheckinIdParam(rawId);
  if ("error" in parsed) return apiError("invalid_params", parsed.error, 400);

  const svc = await createServiceClient();
  const read = (cols: string) =>
    svc.from("cheers_reports").select(cols).eq("id", parsed.id).eq("reporter_id", userId).maybeSingle();
  let { data, error } = await read(MY_REPORT_COLUMNS);
  if (error !== null && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await read(MY_REPORT_COLUMNS_LEGACY));
  }
  if (error !== null) {
    console.error(`[api/v1/me/reports/:id] read error: code=${error.code} message=${error.message}`);
    return apiError("internal", "讀取失敗", 500);
  }
  const row = data as unknown as MyReportRow | null;
  if (row === null || typeof row.id !== "string") return apiError("not_found", "找不到這宗舉報", 404);
  const targets = await loadMyReportTargets(svc as never, [row]);
  return apiOk(toMyReportDetail(row, targets.get(row.id)));
}
