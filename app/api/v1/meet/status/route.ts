import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { MEET_DAILY_LIMIT } from "@/lib/meet";
import { hkDayStartISO } from "@/lib/api/party";
import { requireUserRead, withUserGuard } from "@/lib/api/userRead";

/**
 * UR I.1 遇見狀態（🔒）。
 * `GET /api/v1/meet/status` —— `{discoverable: null|boolean, email_discoverable?: boolean, remaining_today}`。
 * null＝未问过（iOS 弹首次询问）；remaining 按 HK 自然日 10 次口径现算（只读不写）。
 */
async function getHandler(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const svc = await createServiceClient();
  const data = await requireUserRead(
    "meetStatus.quota",
    svc.from("users").select("discoverable,meet_search_date,meet_search_count").eq("id", userId).maybeSingle(),
  );
  const r = ((data ?? {}) as Record<string, unknown>);
  const dayStart = hkDayStartISO(Date.now()).slice(0, 10);
  const sameDay = typeof r.meet_search_date === "string" && r.meet_search_date >= dayStart;
  const used = sameDay && typeof r.meet_search_count === "number" ? r.meet_search_count : 0;
  // 0098 未執行時沒有這一欄：不回該欄位（客戶端隱藏開關），不影響其他狀態
  const email = await svc.from("users").select("email_discoverable").eq("id", userId).maybeSingle();
  const allowEmail = (email.data as { email_discoverable?: unknown } | null)?.email_discoverable;
  return apiOk({
    ...(email.error === null && typeof allowEmail === "boolean" ? { email_discoverable: allowEmail } : {}),
    discoverable: typeof r.discoverable === "boolean" ? r.discoverable : null,
    remaining_today: Math.max(0, MEET_DAILY_LIMIT - used),
  });
}

export const GET = withUserGuard(getHandler);
