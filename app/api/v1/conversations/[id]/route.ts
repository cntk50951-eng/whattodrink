import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseConversationId } from "@/lib/api/chat";

/**
 * UR D.2 刪會話（🔒）。
 * `DELETE /api/v1/conversations/:id` —— 寫自己行的 `hidden_at`（只藏自己，
 * 不刪別人，沿 PDPO 查閱刪除權）；非成員一律 404。
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
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mine === null) {
    return apiError("not_found", "找不到该会话", 404);
  }
  const { error: uErr } = await supabase
    .from("conversation_members")
    .update({ hidden_at: new Date().toISOString() })
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId);
  if (uErr !== null) {
    console.error(`[api/v1/conversations] hide error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "删除会话失败", 500);
  }
  return apiOk({ ok: true });
}
