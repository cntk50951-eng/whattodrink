import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  CHAT_DAY_LIMIT,
  CHAT_MINUTE_LIMIT,
  parseChatListParams,
  parseConversationId,
  parseCreateMessageBody,
  encodeChatCursor,
  toChatMessage,
} from "@/lib/api/chat";

/**
 * UR D.3 消息讀寫（🔒）。
 * `GET /api/v1/conversations/:id/messages?limit&cursor` —— 對話記錄（倒序 keyset，
 * 回正序；非成員 404 fail-closed）。
 */
export async function GET(
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
  const parsed = parseChatListParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { limit, cursor } = parsed.params;
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mine === null) {
    return apiError("not_found", "找不到该会话", 404);
  }
  let query = supabase
    .from("messages")
    .select("id,sender_id,kind,body,created_at")
    .eq("conversation_id", parsedId.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (cursor !== null) {
    // keyset：(created_at, id) 全序倒序翻頁（沿 wall exact-tie 口徑）
    query = query.or(
      `created_at.lt.${cursor.ca},and(created_at.eq.${cursor.ca},id.lt.${cursor.id})`,
    );
  }
  const { data: rows, error: qErr } = await query.limit(limit + 1);
  if (qErr !== null) {
    console.error(`[api/v1/conversations/messages] list error: code=${qErr.code} message=${qErr.message}`);
    return apiError("internal", "读取消息失败", 500);
  }
  const list = ((rows ?? []) as unknown[]).slice(0, limit + 1);
  const mapped = [];
  for (const r of list) {
    const m = toChatMessage(r, userId);
    if (m !== null) mapped.push(m);
  }
  const hasMore = list.length > limit;
  const pageDesc = mapped.slice(0, limit);
  const nextCursor =
    hasMore && pageDesc.length > 0
      ? encodeChatCursor({
          v: 1,
          ca: new Date(pageDesc[pageDesc.length - 1].created_at).toISOString(),
          id: pageDesc[pageDesc.length - 1].id,
        })
      : null;
  // 回正序（聊天流由舊到新；壞行已跳過，頁內不足 स्वयं補——POC 口徑，下頁補齊）
  return apiOk({ messages: pageDesc.reverse(), nextCursor });
}

/**
 * `POST /api/v1/conversations/:id/messages {kind, body, client_msg_id}` —— 發送
 * （首期只收 text；隱身任一端 403；限流 30/min＋200/day；冪等重放回既有行 200；
 * 寫後刷會話 `expires_at`＝now＋90d）。
 */
export async function POST(
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
  const parsed = parseCreateMessageBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // 成員＋隱身雙驗（非成員 404；任一端隱身 403，沿 live 三刀口徑）
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", parsedId.id);
  const memberIds = ((members ?? []) as unknown[]) as { user_id: string }[];
  if (!memberIds.some((m) => m.user_id === userId)) {
    return apiError("not_found", "找不到该会话", 404);
  }
  const { data: modes } = await supabase
    .from("users")
    .select("id,mode")
    .in(
      "id",
      memberIds.map((m) => m.user_id),
    );
  if (
    ((modes ?? []) as unknown[]).some(
      (u) => (u as { mode?: unknown }).mode === "stealth",
    )
  ) {
    return apiError("forbidden", "隱身模式不可收發消息", 403);
  }
  // 限流（兩檔計數；POC 直查，上量後換計數列，見 UR）
  const nowMs = Date.now();
  const { count: minCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", new Date(nowMs - 60_000).toISOString());
  if ((minCount ?? 0) >= CHAT_MINUTE_LIMIT) {
    return apiError("rate_limited", "發送太快，稍後再試", 429);
  }
  const { count: dayCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", new Date(nowMs - 24 * 3600_000).toISOString());
  if ((dayCount ?? 0) >= CHAT_DAY_LIMIT) {
    return apiError("rate_limited", "今日發送已達上限", 429);
  }
  // 冪等：同會話同鍵直接回既有行（弱網重發不 double，沿架構 §5）
  const { data: dup } = await supabase
    .from("messages")
    .select("id,sender_id,kind,body,created_at")
    .eq("conversation_id", parsedId.id)
    .eq("client_msg_id", parsed.client_msg_id)
    .maybeSingle();
  if (dup !== null) {
    const m = toChatMessage(dup, userId);
    if (m !== null) return apiOk({ message: m, duplicate: true });
  }
  const { data: inserted, error: iErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsedId.id,
      sender_id: userId,
      kind: parsed.kind,
      body: parsed.body,
      attachments: [],
      client_msg_id: parsed.client_msg_id,
    })
    .select("id,sender_id,kind,body,created_at")
    .single();
  if (iErr !== null || inserted === null) {
    // 23505 併發撞鍵：回讀既有行（與上同，競態收斂）
    if (iErr?.code === "23505") {
      const { data: raced } = await supabase
        .from("messages")
        .select("id,sender_id,kind,body,created_at")
        .eq("conversation_id", parsedId.id)
        .eq("client_msg_id", parsed.client_msg_id)
        .maybeSingle();
      const m = toChatMessage(raced, userId);
      if (m !== null) return apiOk({ message: m, duplicate: true });
    }
    console.error(`[api/v1/conversations/messages] insert error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "发送失败", 500);
  }
  // 90 天保留：寫後刷會話 expires_at（沿 D.1 設計）
  await supabase
    .from("conversations")
    .update({ expires_at: new Date(nowMs + 90 * 24 * 3600_000).toISOString() })
    .eq("id", parsedId.id);
  const message = toChatMessage(inserted, userId);
  if (message === null) {
    return apiError("internal", "发送失败", 500);
  }
  return apiOk({ message, duplicate: false }, 201);
}
