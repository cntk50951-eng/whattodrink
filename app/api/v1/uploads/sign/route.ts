import { createClient } from "@supabase/supabase-js";

import { getAuthedClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseSignBody } from "@/lib/api/chat";

/**
 * UR D.6 直傳簽名（🔒）。
 * `POST /api/v1/uploads/sign {purpose, ext, bytes}` —— 驗大小＋白名單後，
 * 用 service 簽上傳 URL（客戶端直傳 Storage，不經 server 中轉）；
 * 路徑 `<uid>/<uuid>.<ext>`（首段歸屬 RLS 認，會話歸屬發送時再驗）。
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
    return apiError("invalid_params", parsed.error, 400);
  }
  const bucket = parsed.purpose === "image" ? "chat-images" : "chat-voice";
  const path = `${userId}/${crypto.randomUUID()}.${parsed.ext}`;
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
    return apiOk({ bucket, path, uploadUrl: data.signedUrl, token: data.token });
  } catch (err) {
    console.error(`[api/v1/uploads/sign] threw: ${err instanceof Error ? err.message : "unknown"}`);
    return apiError("internal", "签名失败", 500);
  }
}
