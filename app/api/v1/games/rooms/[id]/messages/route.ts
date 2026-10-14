import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { chatFilterEnabled, filterChatText, parseWordEnv } from "@/lib/games/chatFilter";
import {
  GAME_MSG_MINUTE_LIMIT,
  GAME_MSG_MIN_MS,
  hasBlockOrMute,
  isGameMuted,
  loadRoomAsMember,
  parseGameMessageBody,
  parseRoomId,
} from "@/lib/games/rooms";
import { ipRateLimit } from "@/lib/rateLimit";

/**
 * UR H.2 房内聊天读（🔒，在座成员）。
 * `GET /api/v1/games/rooms/:id/messages?since=&limit=` —— left/kicked 不可读（403）；
 * 按观看者过滤（与我有拉黑／静音关系的成员消息不回）；撤回行只回 `{removed:true}`。
 * 房结束 24h 后懒删消息（touch 即清）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const parsedId = parseRoomId(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  const { data: roomRaw } = await svc
    .from("game_rooms")
    .select("id,status,ended_at")
    .eq("id", parsedId.id)
    .maybeSingle();
  const room = roomRaw as { id: string; status: string; ended_at: string | null } | null;
  if (room === null) {
    return apiError("room_not_found", "房間不存在", 404);
  }
  const { data: myRow } = await svc
    .from("game_room_players")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();
  if ((myRow as { status?: unknown } | null)?.status !== "active") {
    return apiError("not_allowed", "離開房間後不可再看聊天", 403);
  }
  // 24h 懒删（room 结束 24h 后清消息）。
  if (room.status === "ended" && typeof room.ended_at === "string") {
    if (Date.now() - Date.parse(room.ended_at) >= 24 * 3600_000) {
      await svc.from("game_room_messages").delete().eq("room_id", room.id);
    }
  }
  const q = new URL(req.url).searchParams;
  const sinceRaw = q.get("since");
  const sinceMs = sinceRaw !== null ? Date.parse(sinceRaw) : NaN;
  const limitRaw = Number(q.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 50;
  let query = svc
    .from("game_room_messages")
    .select("id,room_id,user_id,kind,body,quick_key,created_at,removed_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);
  if (Number.isFinite(sinceMs)) {
    query = query.gt("created_at", new Date(sinceMs).toISOString());
  }
  const { data: rows, error } = await query;
  if (error !== null) {
    console.error(`[games/messages] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "读取失败", 500);
  }
  const list = (((rows ?? []) as unknown[]) as Record<string, unknown>[]).slice(0, limit + 1);
  const page = list.slice(0, limit);
  // 拉黑／静音过滤（与我有任一方向关系的成员消息不回；自己的照回）。
  const authorIds = [...new Set(page.map((r) => r.user_id).filter((v): v is string => typeof v === "string" && v !== userId))];
  const hidden = new Set<string>();
  for (const aid of authorIds) {
    if (await hasBlockOrMute(svc, userId, aid)) hidden.add(aid);
  }
  const visible = page.filter((r) => r.user_id === userId || !hidden.has(r.user_id as string));
  // 作者昵称头像（陌生人只见昵称＋头像，沿 requests 口径）。
  const showIds = [...new Set(visible.map((r) => r.user_id).filter((v): v is string => typeof v === "string"))];
  const userById = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (showIds.length > 0) {
    const { data: users } = await svc.from("users").select("id,nickname,avatar_url").in("id", showIds);
    for (const u of ((users ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof u.id !== "string") continue;
      userById.set(u.id, {
        nickname: typeof u.nickname === "string" && u.nickname !== "" ? u.nickname : "酒友",
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
      });
    }
  }
  const items = visible.map((r) => {
    const base = { id: r.id, created_at: r.created_at };
    if (r.removed_at !== null && r.removed_at !== undefined) {
      return { ...base, removed: true as const };
    }
    const u = typeof r.user_id === "string" ? (userById.get(r.user_id) ?? { nickname: "酒友", avatar_url: null }) : null;
    return {
      ...base,
      user: typeof r.user_id === "string" ? { id: r.user_id, nickname: u?.nickname ?? "酒友", avatar_url: u?.avatar_url ?? null } : null,
      kind: r.kind,
      ...(r.kind === "quick" ? { quick_key: r.quick_key } : { body: r.body }),
    };
  });
  const next =
    list.length > limit && page.length > 0
      ? (page[page.length - 1].created_at as string | null) ?? null
      : null;
  return apiOk({ items, next });
}

function blockContactsEnabled(): boolean {
  return process.env.GAME_CHAT_BLOCK_CONTACTS === "true";
}

/**
 * UR H.2 房内聊天发（🔒，在座成员，房未结束）。
 * `POST /api/v1/games/rooms/:id/messages` —— 禁言 403／限频 2s·1条＋1min·20条 429／
 * 同内容 10s 内去重（200 同回）／client_msg_id 幂等。
 * 发送路径零外部调用（不断言里测：mock fetch 即炸——见单测）。
 * 本地过滤默认开（lib/games/chatFilter.ts）：严重词 422／一般粗口 ★ 打码；联系方式拦截为可选开关。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
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
  const parsed = parseGameMessageBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const nowMs = Date.now();
  if (await isGameMuted(svc, loaded.room.id, userId)) {
    return apiError("muted_in_room", "你已被禁言到本房結束", 403);
  }
  if (!ipRateLimit(`game-msg:${loaded.room.id}:${userId}`, nowMs, GAME_MSG_MIN_MS, 1).ok) {
    return apiError("chat_rate_limited", "發得太快，稍後再試", 429);
  }
  if (!ipRateLimit(`game-msg-min:${loaded.room.id}:${userId}`, nowMs, 60_000, GAME_MSG_MINUTE_LIMIT).ok) {
    return apiError("chat_rate_limited", "發得太快，稍後再試", 429);
  }
  let text = parsed.body.kind === "text" ? parsed.body.body : null;
  // 本地过滤（默认开；纯本地零外部调用）：严重词拒发 422，一般粗口 ★ 打码后照发；联系方式拦截为可选开关。
  if (text !== null) {
    if (chatFilterEnabled(process.env.GAME_CHAT_FILTER) || blockContactsEnabled()) {
      const verdict = filterChatText(text, {
        extraBlock: parseWordEnv(process.env.GAME_CHAT_WORDLIST),
        extraMask: parseWordEnv(process.env.GAME_CHAT_MASKLIST),
        blockContacts: blockContactsEnabled(),
        wordFilter: chatFilterEnabled(process.env.GAME_CHAT_FILTER),
      });
      if (verdict.action === "block") {
        return apiError(
          "message_rejected",
          verdict.reason === "contact" ? "內容含站外聯繫方式" : "訊息含有不當內容，請修改後再發",
          422,
        );
      }
      if (verdict.action === "mask") text = verdict.text;
    }
    // 同内容 10s 去重（200 同回，不同于幂等键）。
    const since = new Date(nowMs - 10_000).toISOString();
    const { data: dupText } = await svc
      .from("game_room_messages")
      .select("id,created_at")
      .eq("room_id", loaded.room.id)
      .eq("user_id", userId)
      .eq("kind", "text")
      .eq("body", text)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dupText !== null) {
      const d = dupText as { id: string; created_at: string };
      return apiOk({ id: d.id, created_at: d.created_at, duplicate: true });
    }
  }
  const { data: inserted, error: iErr } = await svc
    .from("game_room_messages")
    .insert({
      room_id: loaded.room.id,
      user_id: userId,
      kind: parsed.body.kind,
      body: text ?? "",
      quick_key: parsed.body.kind === "quick" ? parsed.body.quick_key : null,
      client_msg_id: parsed.clientMsgId,
    })
    .select("id,created_at")
    .single();
  if (iErr !== null || inserted === null) {
    if (iErr?.code === "23505") {
      const { data: raced } = await svc
        .from("game_room_messages")
        .select("id,created_at")
        .eq("room_id", loaded.room.id)
        .eq("client_msg_id", parsed.clientMsgId)
        .maybeSingle();
      const r = raced as { id: string; created_at: string } | null;
      if (r !== null) return apiOk({ id: r.id, created_at: r.created_at, duplicate: true });
    }
    console.error(`[games/messages] send error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "發送失敗", 500);
  }
  const row = inserted as { id: string; created_at: string };
  return apiOk({ id: row.id, created_at: row.created_at }, 201);
}
