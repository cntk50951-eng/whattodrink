import { createClient } from "@supabase/supabase-js";

import { getAuthedClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends } from "@/lib/friends";
import { parseViewBody } from "@/lib/api/chat";

/**
 * UR D.6 播時簽名（🔒）。
 * `POST /api/v1/uploads/view {path}` —— 驗歸屬（自己上傳的，或互好友上傳的）
 * 後用 service 簽 120s 下載 URL（私有桶無直讀口；陌生人拿 path 也簽不出）。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseViewBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const ownerId = parsed.path.split("/")[0];
  let allowed = ownerId === userId;
  if (!allowed) {
    // 對方上傳的：須 accepted 互好友（陌生人直接 404，不透露存在性）
    const { data: fsRows } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    allowed = areFriends(
      userId,
      ownerId,
      ((fsRows ?? []) as unknown[]) as {
        user_id: unknown;
        friend_id: unknown;
        status: unknown;
      }[],
    );
  }
  if (!allowed) {
    return apiError("not_found", "找不到该文件", 404);
  }
  const bucket = parsed.bucket;
  try {
    const env = requireSupabaseEnv();
    const svc = createClient(env.url, env.secretKey, { auth: { persistSession: false } });
    const { data, error } = await svc.storage.from(bucket).createSignedUrl(parsed.path, 120);
    if (error !== null || data === null) {
      console.error(`[api/v1/uploads/view] sign error: message=${error?.message}`);
      return apiError("internal", "签名失败", 500);
    }
    return apiOk({ url: data.signedUrl, expiresIn: 120 });
  } catch (err) {
    console.error(`[api/v1/uploads/view] threw: ${err instanceof Error ? err.message : "unknown"}`);
    return apiError("internal", "签名失败", 500);
  }
}
