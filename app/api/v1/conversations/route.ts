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

  // UR D.6 提速：列表 N+1（3N+1 roundtrips）收斂到單 RPC（見 0014；
  // 函數內硬校驗 auth.uid()=p_uid，會話可見性＋水位＋末條＋未讀一次回）。
  const { data: rpcRows, error: rpcErr } = await supabase.rpc("get_conversations", {
    p_uid: userId,
    p_limit: 100,
  });
  if (rpcErr !== null) {
    console.error(`[api/v1/conversations] rpc error: code=${rpcErr.code} message=${rpcErr.message}`);
    return apiError("internal", "读取会话失败", 500);
  }
  type RpcRow = {
    conv_id: string;
    peer_id: string | null;
    nickname: string | null;
    avatar_url: string | null;
    last_id: string | null;
    last_sender: string | null;
    last_kind: string | null;
    last_body: string | null;
    last_ca: string | null;
    last_secs: number | null;
    last_checkin_id: string | null;
    last_place: string | null;
    unread: number | string;
    muted: boolean;
    updated_at: string;
  };
  const items: ConversationJson[] = [];
  for (const r of ((rpcRows ?? []) as unknown[]) as RpcRow[]) {
    const last_message: ChatMessageJson | null =
      r.last_id === null
        ? null
        : toChatMessage(
            {
              id: r.last_id,
              sender_id: r.last_sender,
              kind: r.last_kind,
              body: r.last_body,
              created_at: r.last_ca,
              // D.6 列表語音章秒數（完整附件只在記錄端點回，列表只帶 secs 夠用）
              // UR E.13 分享卡片行（末附件 checkin_id＋place 透出；旧库无列即 undefined，走旧口径）
              attachments:
                typeof r.last_checkin_id === "string" && r.last_checkin_id !== ""
                  ? [
                      typeof r.last_place === "string" && r.last_place !== ""
                        ? { checkin_id: r.last_checkin_id, place: r.last_place }
                        : { checkin_id: r.last_checkin_id },
                    ]
                  : typeof r.last_secs === "number"
                    ? [{ bucket: "chat-voice", path: "", mime: "audio", bytes: 0, secs: r.last_secs }]
                    : [],
            },
            userId,
          );
    const updated_at = Date.parse(r.updated_at);
    items.push({
      id: r.conv_id,
      peer:
        r.peer_id === null
          ? null
          : toChatPeer({ id: r.peer_id, nickname: r.nickname, avatar_url: r.avatar_url }),
      last_message,
      unread: typeof r.unread === "number" ? r.unread : Number(r.unread) || 0,
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
