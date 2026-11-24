import { apiError, apiOk } from "@/lib/api/envelope";
import { parseIvyReport } from "@/lib/barReport";
import { ipRateLimit } from "@/lib/rateLimit";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

/**
 * 舉報酒保 Ivy 的某句回覆（🔒 需登入）。
 * body：`{ reply_text, reason?, user_text?, lang?, platform? }`，reason ∈ sexual／minors／harassment／dangerous_drinking／self_harm／other。
 * 落 `bar_reply_reports`（0083，服務端專用）；每人每小時 20 次（進程級尽力）。回 `{ ok: true }`（201）。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "请先登录。", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "Expected JSON body.", 400);
  }
  const report = parseIvyReport(body);
  if (report === null) return apiError("invalid_params", "缺少要舉報的內容。", 400);

  if (!ipRateLimit(`bar-report:${userId}`, Date.now(), 3_600_000, 20).ok) {
    return apiError("rate_limited", "舉報太頻繁，請稍後再試。", 429, { "Retry-After": "600" });
  }

  const svc = await createServiceClient();
  const { error } = await svc.from("bar_reply_reports").insert({
    reporter_id: userId,
    reply_text: report.replyText,
    user_text: report.userText,
    reason: report.reason,
    lang: report.lang,
    platform: report.platform,
  });
  if (error !== null) {
    console.error(`[bar-report] insert failed: code=${error.code} message=${error.message}`);
    return apiError("internal", "舉報暫時失敗，請稍後再試。", 500);
  }
  return apiOk({ ok: true }, 201);
}
