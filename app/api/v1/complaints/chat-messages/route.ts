import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { directKey } from "@/lib/api/chat";
import { chatCandidateJson } from "@/lib/complaintChat";

/**
 * 投訴「附聊天記錄」候選：我和被投訴人的 1 對 1 私信（只文字；圖片／語音不可附）。
 * `GET /api/v1/complaints/chat-messages?peer=<user_id>&limit=&before=` —— `{has_conversation, messages[], next_before}`；
 * messages 時間升序（舊→新），每條 `{id, from:"me"|"them", kind, body, created_at}`。
 * 兩人之間沒有私信會話（或已過期被清）→ `has_conversation:false`，messages 為空（App 隱藏選擇入口並說明）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const q = new URL(req.url).searchParams;
  const peer = q.get("peer") ?? "";
  if (peer === "" || peer.length > 64 || peer === userId) return apiError("invalid_params", "peer 非法", 400);
  const limitRaw = Number(q.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? limitRaw : 50;
  const before = q.get("before");
  const beforeMs = before !== null ? Date.parse(before) : NaN;
  const svc = await createServiceClient();
  const { data: conv } = await svc
    .from("conversations")
    .select("id,expires_at")
    .eq("type", "direct")
    .eq("direct_key", directKey(userId, peer))
    .maybeSingle();
  const convRow = conv as { id?: unknown; expires_at?: unknown } | null;
  const expired = typeof convRow?.expires_at === "string" && Date.parse(convRow.expires_at) < Date.now();
  if (convRow === null || typeof convRow.id !== "string" || expired) {
    return apiOk({ has_conversation: false, messages: [], next_before: null });
  }
  // 雙方都必須是成員（防 direct_key 異常）
  const { data: members } = await svc
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", convRow.id)
    .in("user_id", [userId, peer]);
  if (!Array.isArray(members) || members.length !== 2) {
    return apiOk({ has_conversation: false, messages: [], next_before: null });
  }
  let query = svc
    .from("messages")
    .select("id,sender_id,kind,body,attachments,created_at")
    .eq("conversation_id", convRow.id)
    .eq("kind", "text")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (Number.isFinite(beforeMs)) query = query.lt("created_at", new Date(beforeMs).toISOString());
  const { data: rows, error } = await query.limit(limit + 1);
  if (error !== null) {
    console.error(`[api/v1/complaints/chat-messages] error: code=${error.code} message=${error.message}`);
    return apiError("internal", "讀取聊天記錄失敗", 500);
  }
  const list = (rows ?? []) as unknown[];
  const page = list.slice(0, limit);
  const messages = page
    .map((r) => chatCandidateJson(r, userId, peer))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .reverse();
  const oldest = messages[0];
  return apiOk({
    has_conversation: true,
    messages,
    next_before: list.length > limit && oldest !== undefined ? oldest.created_at : null,
  });
}
