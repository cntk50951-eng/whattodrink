import { createClient } from "@supabase/supabase-js";

import { getAuthedClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseSignBody } from "@/lib/api/chat";

/**
 * UR D.6 直傳簽名（🔒；D.8 加 sha256＋expires_at）。
 * `POST /api/v1/uploads/sign {purpose, ext, bytes, sha256?}` —— 驗大小＋白名單後，
 * 用 service 簽上傳 URL（客戶端直傳 Storage，不經 server 中轉）；
 * 回 `expires_at`（SDK 無 expiresIn 參數，簽名固定 2h 有效；逾時重簽）；
 * 路徑 `<uid>/<uuid>.<ext>`（首段歸屬 RLS 認，會話歸屬發送時再驗）；
 * `sha256`（hex64）有即確定性路徑 `<uid>/<YYYY-MM>/<sha256[0:32]>.<ext>`，同值重簽同址；
 * bytes 超限 413。
 */
export async function POST(req: Request): Promise<Response> {
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
  const parsed = parseSignBody(raw);
  if ("error" in parsed) {
    if (parsed.status === 413) {
      return apiError("payload_too_large", parsed.error, 413);
    }
    return apiError("invalid_params", parsed.error, 400);
  }
  const bucket = parsed.purpose === "image" ? "chat-images" : parsed.purpose === "voice" ? "chat-voice" : "avatars";
  const path =
    parsed.sha256 === null
      ? `${userId}/${crypto.randomUUID()}.${parsed.ext}`
      : `${userId}/${new Date().toISOString().slice(0, 7)}/${parsed.sha256.slice(0, 32)}.${parsed.ext}`;
  try {
    const env = requireSupabaseEnv();
    const svc = createClient(env.url, env.secretKey, { auth: { persistSession: false } });
    const { data, error } = await svc.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error !== null || data === null) {
      console.error(`[api/v1/uploads/sign] sign error: message=${error?.message}`);
      return apiError("internal", "签名失败", 500);
    }
    // SDK 版无 expiresIn 參數（簽名固定 2h 有效，見 storage-js 文檔；交接 5min 不可配，留痕）；
    // 客戶端拿到立即上傳，逾時重簽。
    return apiOk({
      bucket,
      path,
      uploadUrl: data.signedUrl,
      token: data.token,
      expires_at: Date.now() + 2 * 3600_000,
    });
  } catch (err) {
    console.error(`[api/v1/uploads/sign] threw: ${err instanceof Error ? err.message : "unknown"}`);
    return apiError("internal", "签名失败", 500);
  }
}
