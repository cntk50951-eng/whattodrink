import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { isMinorDob } from "@/lib/api/cheers";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, friendIdsOf } from "@/lib/friends";
import {
  isConversationExpired,
  parseChatListParams,
  parseCreateConversationBody,
  toChatMessage,
  toChatPeer,
  directKey,
  encodeChatCursor,
  strangerQuota,
  STRANGER_MSG_LIMIT,
  type ChatMessageJson,
  type ConversationJson,
} from "@/lib/api/chat";

const NINETY_DAYS_MS = 90 * 24 * 3600_000;

/**
 * UR D.2 會話 API（🔒；D.10 陌生人放行）。
 * `POST /api/v1/conversations {user_id, origin?}` —— find-or-create（1v1 去重鍵；
 * 好友即建；陌生人亦可建（拉黑 404／未成年 403／每日新建 10 个）；
 * 建前驗雙非隱身；建會話三行一事務走 service_role，
 * RLS 表達不了對方關係校驗，沿 D.1 設計）。
 * 回 `{id, created, is_friend, origin}`。
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
  // UR D.10 陌生人放行（不限关系； RSVP 门改拉黑＋未成年＋日限额）。
  // 拉黑任一方向即 404（不泄存在，沿 profile 口径）。
  const { data: blockRows } = await supabase
    .from("cheers_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${userId})`)
    .limit(1);
  if (Array.isArray(blockRows) && blockRows.length > 0) {
    return apiError("not_found", "找不到该用户", 404);
  }
  // 未成年禁发起（沿 cheers 口径；dob 缺席放行）。
  const { data: minorRow } = await supabase
    .from("users")
    .select("dob")
    .eq("id", userId)
    .maybeSingle();
  if (isMinorDob((minorRow as { dob?: unknown } | null)?.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可聊天", 403);
  }
  // 好友判定（建会话依据 origin；好友建即 friend）。
  const { data: fsRows } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const isFriend = areFriends(
    userId,
    peerId,
    ((fsRows ?? []) as unknown[]) as {
      user_id: unknown;
      friend_id: unknown;
      status: unknown;
    }[],
  );
  const origin = isFriend ? "friend" : parsed.origin;

  const key = directKey(userId, peerId);
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: existing } = await svc
    .from("conversations")
    .select("id,expires_at,origin")
    .eq("type", "direct")
    .eq("direct_key", key)
    .maybeSingle();
  const existingRow = existing as { id: string; expires_at: string; origin: string | null } | null;
  if (existingRow !== null && !isConversationExpired(existingRow.expires_at, nowMs)) {
    // 順手清掉我自己的 hidden（重開會話即回列表；對方的不動）
    await svc
      .from("conversation_members")
      .update({ hidden_at: null })
      .eq("conversation_id", existingRow.id)
      .eq("user_id", userId);
    return apiOk({
      id: existingRow.id,
      created: false,
      is_friend: isFriend,
      origin: isFriend ? "friend" : (existingRow.origin ?? "direct"),
    });
  }
  if (existingRow !== null) {
    // 90 天過期即硬刪（retention 落地；CASCADE 帶走成員＋消息）
    await svc.from("conversations").delete().eq("id", existingRow.id);
  }
  if (!isFriend) {
    // 每日新建陌生人会话 10 个（HK 天；防批量打招呼，沿 invites 口径）。
    const hk = new Date(nowMs + 8 * 3600_000);
    hk.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(hk.getTime() - 8 * 3600_000).toISOString();
    const { data: myConvs } = await svc
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId)
      .limit(500);
    const myIds = (((myConvs ?? []) as unknown[]) as { conversation_id: unknown }[])
      .map((m) => m.conversation_id)
      .filter((id): id is string => typeof id === "string");
    let todayStrangers = 0;
    if (myIds.length > 0) {
      const { data: fresh } = await svc
        .from("conversations")
        .select("id")
        .in("id", myIds)
        .gte("created_at", dayStart)
        .neq("origin", "friend");
      todayStrangers = ((fresh ?? []) as unknown[]).length;
    }
    if (todayStrangers >= 10) {
      return apiError("rate_limited", "今日新建陌生人会话已达上限", 429);
    }
  }
  const expiresAt = new Date(nowMs + NINETY_DAYS_MS).toISOString();
  const { data: created, error: cErr } = await svc
    .from("conversations")
    .insert({ type: "direct", direct_key: key, expires_at: expiresAt, origin })
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
  return apiOk({ id: convId, created: true, is_friend: isFriend, origin }, 201);
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
  // UR D.10 行三字段（RPC 不动，路由拼：好友集一次＋origin 批量＋陌生人行逐查配额）。
  const { data: myFs } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const myFids = friendIdsOf(
    userId,
    ((myFs ?? []) as unknown[]) as { user_id: unknown; friend_id: unknown; status: unknown }[],
  );
  const convIds = (((rpcRows ?? []) as unknown[]) as { conv_id?: unknown }[])
    .map((r) => r.conv_id)
    .filter((id): id is string => typeof id === "string");
  const originById = new Map<string, string>();
  if (convIds.length > 0) {
    const { data: convRows } = await supabase
      .from("conversations")
      .select("id,origin")
      .in("id", convIds);
    for (const c of ((convRows ?? []) as unknown[]) as { id?: unknown; origin?: unknown }[]) {
      if (typeof c.id === "string" && typeof c.origin === "string") {
        originById.set(c.id, c.origin);
      }
    }
  }
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
    const rowFriend = r.peer_id !== null && myFids.includes(r.peer_id);
    const rowOrigin = originById.get(r.conv_id) ?? (rowFriend ? "friend" : "direct");
    let rowQuota: { limit: number; used: number; remaining: number } | null = null;
    if (!rowFriend && r.peer_id !== null) {
      const { data: recent } = await supabase
        .from("messages")
        .select("sender_id,created_at")
        .eq("conversation_id", r.conv_id)
        .order("created_at", { ascending: false })
        .limit(50);
      const asc = (((recent ?? []) as unknown[]) as { sender_id: unknown; created_at: unknown }[])
        .filter(
          (m): m is { sender_id: string; created_at: string } =>
            typeof m.sender_id === "string" && typeof m.created_at === "string",
        )
        .reverse();
      const qq = strangerQuota(asc, userId);
      rowQuota = { limit: STRANGER_MSG_LIMIT, used: qq.used, remaining: qq.remaining };
    }
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
      is_friend: rowFriend,
      origin: rowOrigin,
      quota: rowQuota,
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
