import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseConversationId, parseReadBody } from "@/lib/api/chat";

/**
 * UR D.2 讀水位（🔒）。
 * `PATCH /api/v1/conversations/:id/read {last_read_at}` —— 只寫自己的水位行；
 * 非成員一律 404（fail-closed，不透露會話存在性）。
 */
export async function PATCH(
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
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseReadBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
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
    .update({ last_read_at: new Date(parsed.last_read_at).toISOString() })
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId);
  if (uErr !== null) {
    console.error(`[api/v1/conversations/read] update error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "更新水位失败", 500);
  }
  return apiOk({ ok: true, last_read_at: parsed.last_read_at });
}
