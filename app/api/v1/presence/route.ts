import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parsePresenceBody } from "@/lib/presence";

/**
 * UR A.21 心跳上報 `POST /api/v1/presence {lat, lng}`（🔒）。
 * - 隱身 403 且**不碰行**（A.16 雙保險：前端不發＋此處拒）。
 * - 非隱身：`live_lat／live_lng＋last_seen_at` 原子更新（鮮度沿 UR3.3 窗）。
 * - 頻率門（30s＋50m）在客戶端；server 只驗形狀，不驗節流。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return apiError("invalid_params", "body 需为 JSON 对象", 400);
  }
  const parsed = parsePresenceBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { data: me, error: meErr } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if (meErr !== null) {
    return apiError("internal", "读取用户失败", 500);
  }
  const mode = (me as { mode?: unknown } | null)?.mode;
  if (mode === "stealth") {
    return apiError("forbidden", "隐身模式不记录位置", 403);
  }
  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("users")
    .update({
      live_lat: parsed.body.lat,
      live_lng: parsed.body.lng,
      last_seen_at: nowIso,
    })
    .eq("id", userId);
  if (upErr !== null) {
    return apiError("internal", "写入位置失败", 500);
  }
  return apiOk({ ok: true, seen_at: nowIso });
}
