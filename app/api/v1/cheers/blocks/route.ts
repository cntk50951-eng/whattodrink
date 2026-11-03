import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UR E.15 屏蔽（🔒）。
 * `POST /api/v1/cheers/blocks {blocked_id}` —— upsert 幂等；
 * 双向任一有行，发送侧静默拒（中性文案，不泄谁屏蔽谁）。
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
  const id = (raw as Record<string, unknown>).blocked_id;
  // 非 uuid 的 id（mock／占位）进库会 22P02 → 之前一律落成 500「屏蔽失败」，改成明确的 400
  if (typeof id !== "string" || id === userId || !UUID_RE.test(id)) {
    return apiError("invalid_params", "blocked_id 非法", 400);
  }
  // 身份已由 getAuthedClient 验过（userId 来自 token）；写入走 service，不依赖 Bearer 客户端的 RLS／grants
  // （Bearer 路径下 upsert 的 ON CONFLICT DO UPDATE 需要 UPDATE 权限，曾是 iOS 端屏蔽失败的疑点）。
  const service = await createServiceClient();
  const { error } = await service
    .from("cheers_blocks")
    .upsert({ blocker_id: userId, blocked_id: id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error !== null) {
    console.error(`[api/v1/cheers/blocks] upsert error: code=${error.code} message=${error.message}`);
    // 23503：对方不在 users（已注销／不存在）
    if (error.code === "23503") {
      return apiError("not_found", "用户不存在", 404);
    }
    return apiError("internal", "屏蔽失败", 500);
  }
  return apiOk({ blocked: true });
}

/**
 * UR B.3 解除屏蔽（🔒，幂等）。
 * `DELETE /api/v1/cheers/blocks {blocked_id}` —— 删本人对该用户的屏蔽行；
 * 找不到也 200。只解手动屏蔽；新版解除好友的自动禁言（chat_mutes）
 * 在重加被接受时自动成对清除，不走本口。
 */
export async function DELETE(req: Request): Promise<Response> {
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
  const id = (raw as Record<string, unknown>).blocked_id;
  if (typeof id !== "string" || id === userId || !UUID_RE.test(id)) {
    return apiError("invalid_params", "blocked_id 非法", 400);
  }
  const service = await createServiceClient();
  const { error } = await service
    .from("cheers_blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", id);
  if (error !== null) {
    console.error(`[api/v1/cheers/blocks] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "解除屏蔽失败", 500);
  }
  return apiOk({ unblocked: true });
}
