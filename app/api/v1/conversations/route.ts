import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends } from "@/lib/friends";
import {
  isConversationExpired,
  parseChatListParams,
  parseCreateConversationBody,
  toChatMessage,
  toChatPeer,
  directKey,
  encodeChatCursor,
  type ChatMessageJson,
  type ConversationJson,
} from "@/lib/api/chat";

const NINETY_DAYS_MS = 90 * 24 * 3600_000;

/**
 * UR D.2 會話 API（🔒）。
 * `POST /api/v1/conversations {user_id}` —— find-or-create（1v1 去重鍵；
 * 建前驗 accepted 互好友＋雙非隱身；建會話三行一事務走 service_role，
 * RLS 表達不了對方關係校驗，沿 D.1 設計）。
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
  const parsed = parseCreateConversationBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const peerId = parsed.user_id;
  if (peerId === userId) {
    return apiError("invalid_params", "不能和自己聊天", 400);
  }

  // 對方存在＋模式（陌生人 fail-closed：查無此人按 404，不透露註冊態細節也無妨，POC 取直白）
  const { data: peer } = await supabase
    .from("users")
    .select("id,mode")
    .eq("id", peerId)
    .maybeSingle();
  const peerRow = peer as { id?: unknown; mode?: unknown } | null;
  if (peerRow === null || typeof peerRow.id !== "string") {
    return apiError("not_found", "找不到该用户", 404);
  }
  if (peerRow.mode === "stealth") {
    return apiError("forbidden", "對方處於隱身模式，暫不可聊天", 403);
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可發起聊天", 403);
  }
  // 互好友驗證（陌生人永不，沿 EPIC B fail-closed）
  const { data: fsRows } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (
    !areFriends(
      userId,
      peerId,
      ((fsRows ?? []) as unknown[]) as {
        user_id: unknown;
        friend_id: unknown;
        status: unknown;
      }[],
    )
  ) {
    return apiError("forbidden", "僅互為好友可聊天", 403);
  }

  const key = directKey(userId, peerId);
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: existing } = await svc
    .from("conversations")
    .select("id,expires_at")
    .eq("type", "direct")
    .eq("direct_key", key)
    .maybeSingle();
  const existingRow = existing as { id: string; expires_at: string } | null;
  if (existingRow !== null && !isConversationExpired(existingRow.expires_at, nowMs)) {
    // 順手清掉我自己的 hidden（重開會話即回列表；對方的不動）
    await svc
      .from("conversation_members")
      .update({ hidden_at: null })
      .eq("conversation_id", existingRow.id)
      .eq("user_id", userId);
    return apiOk({ id: existingRow.id, created: false });
  }
  if (existingRow !== null) {
    // 90 天過期即硬刪（retention 落地；CASCADE 帶走成員＋消息）
    await svc.from("conversations").delete().eq("id", existingRow.id);
  }
  const expiresAt = new Date(nowMs + NINETY_DAYS_MS).toISOString();
  const { data: created, error: cErr } = await svc
    .from("conversations")
    .insert({ type: "direct", direct_key: key, expires_at: expiresAt })
    .select("id")
    .single();
  if (cErr !== null || created === null) {
    console.error(`[api/v1/conversations] create error: code=${cErr?.code} message=${cErr?.message}`);
    return apiError("internal", "建会话失败", 500);
  }
  const convId = (created as { id: string }).id;
  const { error: mErr } = await svc.from("conversation_members").insert([
    { conversation_id: convId, user_id: userId, last_read_at: new Date(nowMs).toISOString() },
    { conversation_id: convId, user_id: peerId, last_read_at: new Date(nowMs).toISOString() },
  ]);
  if (mErr !== null) {
    console.error(`[api/v1/conversations] members error: code=${mErr.code} message=${mErr.message}`);
    await svc.from("conversations").delete().eq("id", convId);
    return apiError("internal", "建会话失败", 500);
  }
  return apiOk({ id: convId, created: true }, 201);
}

/**
 * `GET /api/v1/conversations?limit&cursor` —— 消息列表：
 * 我的會話（未藏＋未過期）逐會話回對方簡檔＋末條＋未讀數（水位現算）。
 * POC 量級走 N+1（會話數＜50 常態；上量後換單 RPC，見註）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const parsed = parseChatListParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { limit, cursor } = parsed.params;
  const nowMs = Date.now();

  const { data: myRows, error: mErr } = await supabase
    .from("conversation_members")
    .select("conversation_id,last_read_at,muted,hidden_at,conversations!inner(id,expires_at)")
    .eq("user_id", userId)
    .is("hidden_at", null);
  if (mErr !== null) {
    console.error(`[api/v1/conversations] list error: code=${mErr.code} message=${mErr.message}`);
    return apiError("internal", "读取会话失败", 500);
  }
  type MyRow = {
    conversation_id: string;
    last_read_at: string;
    muted: boolean;
    conversations: { id: string; expires_at: string };
  };
  const items: ConversationJson[] = [];
  // DEF-011 續：對方成員行走 service（RLS 只許讀自己行，authed 查不到對方；
  // 到此已用 authed 自行驗過我是成員，fail-closed 不動，見上）。
  const svc = await createServiceClient();
  for (const r of ((myRows ?? []) as unknown[]) as MyRow[]) {
    if (isConversationExpired(r.conversations.expires_at, nowMs)) continue;
    const convId = r.conversation_id;
    const lastReadMs = Date.parse(r.last_read_at);
    // 對方成員 id（1v1 取非我；group 預留取首個非我，peer 置該人）
    const { data: members } = await svc
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", convId);
    const peerId = (
      ((members ?? []) as unknown[]) as { user_id: string }[]
    ).map((m) => m.user_id).find((id) => id !== userId) ?? null;
    let peer = null;
    if (peerId !== null) {
      const { data: prow } = await svc
        .from("users")
        .select("id,nickname,avatar_url")
        .eq("id", peerId)
        .maybeSingle();
      peer = toChatPeer(prow);
    }
    const { data: lastRows } = await supabase
      .from("messages")
      .select("id,sender_id,kind,body,created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(1);
    const lastRaw = ((lastRows ?? []) as unknown[])[0] ?? null;
    const last_message: ChatMessageJson | null =
      lastRaw === null ? null : toChatMessage(lastRaw, userId);
    let unread = 0;
    if (Number.isFinite(lastReadMs)) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .neq("sender_id", userId)
        .gt("created_at", new Date(lastReadMs).toISOString());
      unread = count ?? 0;
    }
    const updated_at = last_message?.created_at ?? Date.parse(r.last_read_at);
    items.push({
      id: convId,
      peer,
      last_message,
      unread,
      muted: r.muted,
      updated_at: Number.isFinite(updated_at) ? updated_at : nowMs,
    });
  }
  items.sort((a, b) => b.updated_at - a.updated_at || (a.id < b.id ? -1 : 1));
  // 內存 keyset（cursor 錨末動時間＋id；POC 量級可為，見註）
  let start = 0;
  if (cursor !== null) {
    const cursorMs = Date.parse(cursor.ca);
    start = items.findIndex(
      (c) =>
        c.updated_at < cursorMs || (c.updated_at === cursorMs && c.id < cursor.id),
    );
    if (start === -1) return apiOk({ conversations: [], nextCursor: null });
  }
  const slice = items.slice(start, start + limit + 1);
  const page = slice.slice(0, limit);
  const nextCursor =
    slice.length > limit
      ? encodeChatCursor({
          v: 1,
          ca: new Date(page[page.length - 1].updated_at).toISOString(),
          id: page[page.length - 1].id,
        })
      : null;
  // 空頁兜底：page 空時不取 [-1]（上已 early-return，雙保險）
  return apiOk({ conversations: page, nextCursor });
}
