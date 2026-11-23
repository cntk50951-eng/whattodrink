import { after } from "next/server";

import { apiError, apiOk } from "@/lib/api/envelope";
import { forwardToPostHog, parseTelemetryBatch } from "@/lib/api/telemetry";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";

/**
 * 第一方埋點批次上報（0081；支援未登入與已登入用戶）：
 * POST /api/v1/telemetry/events  body: { events: [...] }
 * - 已登入時由後端自動填入 user_id（不信任客戶端傳入）
 * - 以 event_id 冪等去重（弱網重試不重複記數）
 * - 若設定 POSTHOG_API_KEY，響應後背景轉發 PostHog（不阻塞主請求）
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_params", "JSON 解析失敗", 400);
  }

  const parsed = parseTelemetryBatch(body);
  if (!parsed.ok) {
    return apiError("invalid_params", parsed.error, 400);
  }
  if (parsed.events.length === 0) {
    return apiOk({ accepted: 0 });
  }

  // 可選身份解析：未登入照常接收匿名漏斗（如 auth_open）
  let userId: string | null = null;
  try {
    const auth = await getAuthedClient(req);
    userId = auth.userId;
  } catch {
    userId = null;
  }

  const rows = parsed.events.map((e) => ({
    ...e,
    user_id: userId,
  }));

  const svc = await createServiceClient();
  const { error } = await svc
    .from("analytics_events")
    .upsert(rows, { onConflict: "event_id", ignoreDuplicates: true });

  if (error !== null) {
    // 遷移 0081 未執行前優雅降級，不讓 App 端報錯
    if (error.code === "42P01") {
      return apiOk({ accepted: 0, pending_migration: true });
    }
    console.error(`[api/v1/telemetry/events] insert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "埋點寫入失敗", 500);
  }

  // 未來切換 PostHog：設 POSTHOG_API_KEY 後自動背景轉發
  after(async () => {
    await forwardToPostHog(rows);
  });

  return apiOk({ accepted: rows.length });
}
