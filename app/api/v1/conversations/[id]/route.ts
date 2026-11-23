import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseConversationId } from "@/lib/api/chat";

/**
 * UR D.2 刪會話／清空聊天紀錄（🔒）。
 * `DELETE /api/v1/conversations/:id`（預設）：寫自己行的 `hidden_at` 與 `cleared_before`
 * （從列表移除並清空既有紀錄，只影響自己、不刪對方；對方再發新消息時會話會自動復現且只見新消息）。
 * `DELETE /api/v1/conversations/:id?mode=clear`：僅寫 `cleared_before`（保留會話在列表、清空畫面紀錄）。
 * 非成員一律 404。
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsedId = parseConversationId(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  const clearOnly = new URL(req.url).searchParams.get("mode") === "clear";
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mine === null) {
    return apiError("not_found", "找不到该会话", 404);
  }
  const nowIso = new Date().toISOString();
  const patch = clearOnly
    ? { cleared_before: nowIso, last_read_at: nowIso }
    : { hidden_at: nowIso, cleared_before: nowIso, last_read_at: nowIso };
  let { error: uErr } = await supabase
    .from("conversation_members")
    .update(patch)
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId);
  // 0079 未跑前兼容：退回只寫 hidden_at（或 clearOnly 下回明確 503）
  if (uErr !== null && uErr.code === "42703") {
    if (clearOnly) {
      return apiError("internal", "尚未執行聊天刪除遷移（0079）", 500);
    }
    ({ error: uErr } = await supabase
      .from("conversation_members")
      .update({ hidden_at: nowIso })
      .eq("conversation_id", parsedId.id)
      .eq("user_id", userId));
  }
  if (uErr !== null) {
    console.error(`[api/v1/conversations] hide error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "删除会话失败", 500);
  }
  return apiOk({ ok: true, mode: clearOnly ? "clear" : "delete" });
}
