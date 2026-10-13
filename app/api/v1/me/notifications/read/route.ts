import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * 阶段 A 通知标已读（🔒）。
 * `PATCH /api/v1/me/notifications/read {ids?: [...]}` —— 缺省全标已读；
 * 给 ids 即只标这些（仍限本人行）。回 `{ok:true}`。
 */
export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const idsRaw = (raw as Record<string, unknown>).ids;
  let ids: string[] | null = null;
  if (idsRaw !== undefined) {
    if (!Array.isArray(idsRaw)) {
      return apiError("invalid_params", "ids 只要数组", 400);
    }
    ids = idsRaw.filter((id): id is string => typeof id === "string" && id !== "").slice(0, 200);
  }
  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();
  let query = svc.from("notifications").update({ read_at: nowIso }).eq("user_id", userId).is("read_at", null);
  if (ids !== null) {
    if (ids.length === 0) return apiOk({ ok: true });
    query = query.in("id", ids);
  }
  const { error } = await query;
  if (error !== null) {
    console.error(`[api/v1/me/notifications/read] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "標記失敗", 500);
  }
  return apiOk({ ok: true });
}
