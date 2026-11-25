import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCompositeCursor } from "@/lib/api/compositeCursor";
import {
  MY_REPORT_COLUMNS,
  MY_REPORT_COLUMNS_LEGACY,
  loadMyReportTargets,
  parseMyReportsLimit,
  toMyReportItem,
  type MyReportRow,
} from "@/lib/api/myReports";

/**
 * 我的舉報列表（🔒；iOS DEF-20261125-021〜024，openapi 1.71.0）。
 * `GET /api/v1/me/reports?limit=20&cursor=<created_at>|<id>` → `{items, next_cursor}`，新到舊。
 * 只回舉報人自己的案件；狀態按舉報人視角（reviewing／actioned／dismissed），不含 AI 分數。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const url = new URL(req.url);
  const limit = parseMyReportsLimit(url.searchParams.get("limit"));
  // 沒轉義 `+` 的客戶端：時區 `+00:00` 會被解成空格，換回來再解析
  const rawCursor = url.searchParams.get("cursor")?.replace(/ /g, "+") ?? null;
  const cursor = parseCompositeCursor(rawCursor);
  if (rawCursor !== null && cursor === null) return apiError("invalid_params", "cursor 非法", 400);

  const svc = await createServiceClient();
  const query = (cols: string) => {
    let q = svc
      .from("cheers_reports")
      .select(cols)
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (cursor !== null) {
      q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    }
    return q;
  };
  let { data, error } = await query(MY_REPORT_COLUMNS);
  if (error !== null && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await query(MY_REPORT_COLUMNS_LEGACY));
  }
  if (error !== null) {
    console.error(`[api/v1/me/reports] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "讀取失敗", 500);
  }
  const rows = ((data ?? []) as unknown as MyReportRow[]).filter((r) => typeof r.id === "string");
  const page = rows.slice(0, limit);
  const targets = await loadMyReportTargets(svc as never, page);
  const last = page[page.length - 1];
  const next =
    rows.length > limit && last !== undefined && typeof last.created_at === "string" ? `${last.created_at}|${last.id}` : null;
  return apiOk({ items: page.map((r) => toMyReportItem(r, targets.get(r.id))), next_cursor: next });
}
