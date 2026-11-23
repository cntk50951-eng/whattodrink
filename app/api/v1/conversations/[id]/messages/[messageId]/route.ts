import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  canRecallMessage,
  parseConversationId,
  parseDeleteMessageScope,
  parseMessageId,
} from "@/lib/api/chat";

/**
 * 單條聊天訊息刪除（🔒；對標 WhatsApp）：
 * `DELETE /api/v1/conversations/:id/messages/:messageId?scope=me|everyone`
 * - `scope=me`（預設）：任何成員皆可刪任何訊息（含自己與對方），寫 `message_deletions`，只從自己視野消失。
 * - `scope=everyone`：僅發送者本人且發送 48 小時內可撤回，寫 `messages.deleted_at`，雙方皆不可見（不物理刪除，保留投訴審計）。
 * 非成員或訊息不屬該會話一律 404 fail-closed。
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id, messageId } = await params;
  const parsedConv = parseConversationId(id);
  if ("error" in parsedConv) {
    return apiError("invalid_params", parsedConv.error, 400);
  }
  const parsedMsg = parseMessageId(messageId);
  if ("error" in parsedMsg) {
    return apiError("invalid_params", parsedMsg.error, 400);
  }
  const scope = parseDeleteMessageScope(new URL(req.url).searchParams.get("scope"));
  if (typeof scope !== "string") {
    return apiError("invalid_params", scope.error, 400);
  }

  // 成員校驗（fail-closed 404）
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsedConv.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mine === null) {
    return apiError("not_found", "找不到该会话", 404);
  }

  const svc = await createServiceClient();
  const { data: msgRaw, error: readErr } = await svc
    .from("messages")
    .select("id,conversation_id,sender_id,created_at,deleted_at")
    .eq("id", parsedMsg.id)
    .eq("conversation_id", parsedConv.id)
    .maybeSingle();
  if (readErr !== null && readErr.code === "42703") {
    return apiError("internal", "尚未執行聊天刪除遷移（0079）", 500);
  }
  if (readErr !== null) {
    console.error(`[api/v1/conversations/messages/delete] read error: code=${readErr.code} message=${readErr.message}`);
    return apiError("internal", "刪除訊息失敗", 500);
  }
  const msg = msgRaw as {
    id: string;
    conversation_id: string;
    sender_id: string;
    created_at: string;
    deleted_at: string | null;
  } | null;
  if (msg === null) {
    return apiError("not_found", "找不到該訊息", 404);
  }

  if (scope === "me") {
    const { error: delErr } = await svc
      .from("message_deletions")
      .upsert(
        { message_id: msg.id, user_id: userId, deleted_at: new Date().toISOString() },
        { onConflict: "message_id,user_id" },
      );
    if (delErr !== null) {
      console.error(`[api/v1/conversations/messages/delete] me error: code=${delErr.code} message=${delErr.message}`);
      return apiError("internal", "刪除訊息失敗", 500);
    }
    return apiOk({ ok: true, scope: "me", id: msg.id });
  }

  // scope === "everyone"（雙方撤回）
  const check = canRecallMessage(msg.sender_id, userId, msg.created_at, Date.now());
  if (!check.ok) {
    return apiError(check.code, check.message, check.status);
  }
  if (msg.deleted_at !== null) {
    return apiOk({ ok: true, scope: "everyone", id: msg.id });
  }
  const { error: updErr } = await svc
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", msg.id)
    .eq("conversation_id", parsedConv.id);
  if (updErr !== null) {
    console.error(`[api/v1/conversations/messages/delete] recall error: code=${updErr.code} message=${updErr.message}`);
    return apiError("internal", "撤回訊息失敗", 500);
  }
  return apiOk({ ok: true, scope: "everyone", id: msg.id });
}
