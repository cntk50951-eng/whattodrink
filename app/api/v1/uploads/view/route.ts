import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getAuthedClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseViewBody } from "@/lib/api/chat";

/**
 * UR D.6 播時簽名（🔒）。
 * `POST /api/v1/uploads/view {bucket, path}` —— 驗授權後用 service 簽 120s 下載 URL
 * （私有桶無直讀口）。授權二選一：
 * - 自己上傳的（path 首段＝我）；
 * - 对方上传的：我是该附件所在会话的成员，且该 bucket/path 是该会话某条消息的附件
 *   （§十五.2：不再要求当前是好友；陌生人／拉黑／chat_mutes 不影响，只读历史）。
 * 不符即 404（不透露存在性）。只服务聊天桶，头像不走本口。
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
  const parsed = parseViewBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  try {
    const env = requireSupabaseEnv();
    const svc = createClient(env.url, env.secretKey, { auth: { persistSession: false } });
    const ownerId = parsed.path.split("/")[0];
    const allowed =
      ownerId === userId || (await isAttachmentInMyConversation(svc, userId, parsed.bucket, parsed.path));
    if (!allowed) {
      return apiError("not_found", "找不到该文件", 404);
    }
    const { data, error } = await svc.storage.from(parsed.bucket).createSignedUrl(parsed.path, 120);
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

type ServiceClient = SupabaseClient;

/**
 * 该 bucket/path 是否为我所在某会话里某条消息的附件。
 * 走 service（messages／conversation_members 对跨人推导不返全量，沿 DEF-20261010-001）；
 * 查询全部按 userId 限域，不靠 RLS。
 */
async function isAttachmentInMyConversation(
  svc: ServiceClient,
  userId: string,
  bucket: string,
  path: string,
): Promise<boolean> {
  const { data: msgs, error: mErr } = await svc
    .from("messages")
    .select("conversation_id")
    .contains("attachments", [{ bucket, path }])
    .limit(50);
  if (mErr !== null) {
    console.error(`[api/v1/uploads/view] msg lookup error: code=${mErr.code} message=${mErr.message}`);
    return false;
  }
  const convIds = [
    ...new Set(
      ((msgs ?? []) as unknown[]).map((r) => (r as { conversation_id?: unknown }).conversation_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  if (convIds.length === 0) return false;
  const { data: mine, error: cErr } = await svc
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId)
    .in("conversation_id", convIds)
    .limit(1);
  if (cErr !== null) {
    console.error(`[api/v1/uploads/view] member lookup error: code=${cErr.code} message=${cErr.message}`);
    return false;
  }
  return Array.isArray(mine) && mine.length > 0;
}
