import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin } from "@/lib/api/checkins";
import { friendIdsOf } from "@/lib/friends";
import {
  CHAT_DAY_LIMIT,
  CHAT_MINUTE_LIMIT,
  parseChatListParams,
  parseConversationId,
  parseCreateMessageBody,
  encodeChatCursor,
  toChatMessage,
  isSizeWithin,
  strangerQuota,
  STRANGER_MSG_LIMIT,
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
    .select("id,sender_id,kind,body,attachments,created_at")
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
 * （text 必正文；image caption 可选；audio 不带正文；隱身任一端 403；
 * 限流 30/min＋200/day；冪等重放回既有行 200；文件附件驗存在＋±10% 大小；
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
    if (parsed.status === 413) {
      return apiError("payload_too_large", parsed.error, 413);
    }
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
  // UR D.10 好友判定（陌生人配额／kind 门／分享放宽用；好友免检）。
  const peerIds = memberIds.map((m) => m.user_id).filter((mid) => mid !== userId);
  let isFriend = true;
  {
    const { data: fsRows } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .limit(200);
    const myFids = friendIdsOf(
      userId,
      ((fsRows ?? []) as unknown[]) as {
        user_id: unknown;
        friend_id: unknown;
        status: unknown;
      }[],
    );
    // direct 1v1：除自己外唯一成员即对方；群预留（多人即按"有陌生人"从严）。
    isFriend = peerIds.length > 0 && peerIds.every((pid) => myFids.includes(pid));
  }  const { data: modes } = await supabase
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
  // D.6 附件歸屬：path 首段必須是自己（storage RLS 同口徑，雙保險；
  // 陌生人拿別人的 path 發即 400，會話成員校验在下）。
  // UR E.13 站内分享（非文件附件，无 path）：仅自家帖可分享＋对方须可见；
  // 跳过归属校验，原样存 [{checkin_id}]。
  let attachments: { path: string; mime: string; bytes: number; secs?: number }[] | { checkin_id: string; place?: string }[] = [];
  if (parsed.kind === "text" && parsed.share !== undefined) {
    const { data: postRaw } = await supabase
      .from("checkins")
      .select("id,user_id,visibility")
      .eq("id", parsed.share.checkin_id)
      .maybeSingle();
    const post = postRaw as { id: string; user_id: string | null; visibility: unknown } | null;
    if (post === null) {
      return apiError("not_found", "打卡不存在", 404);
    }
    // 仅自家可分享（UR 范围；他人帖分享另议）。
    if (post.user_id === null || post.user_id !== userId) {
      // UR D.10 他人帖放宽：我碰过该帖＋我本来可见（陌生人快捷回复带被碰卡片）。
      if (post.user_id === null) {
        return apiError("forbidden", "只能分享自己的打卡", 403);
      }
      const { data: cheered } = await supabase
        .from("cheers")
        .select("id")
        .eq("from_user_id", userId)
        .eq("checkin_id", post.id)
        .limit(1);
      if (!Array.isArray(cheered) || cheered.length === 0) {
        return apiError("forbidden", "只能分享自己的打卡", 403);
      }
      const { data: myFs } = await supabase
        .from("friendships")
        .select("user_id,friend_id,status")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .limit(200);
      const myFids = friendIdsOf(
        userId,
        ((myFs ?? []) as unknown[]) as {
          user_id: unknown;
          friend_id: unknown;
          status: unknown;
        }[],
      );
      if (!canViewCheckin(userId, post.user_id, post.visibility, myFids)) {
        return apiError("forbidden", "對方無權查看這條打卡", 403);
      }
    }
    // 对方须可见（direct 1v1：除自己的另一成员；不可见 403 明拒）。
    const peerIds = memberIds.map((m) => m.user_id).filter((mid) => mid !== userId);
    let blocked = false;
    for (const peerId of peerIds) {
      let fids: string[] = [];
      if (post.visibility === "friends") {
        const { data: fsRows } = await supabase
          .from("friendships")
          .select("user_id,friend_id,status")
          .or(`user_id.eq.${peerId},friend_id.eq.${peerId}`)
          .limit(200);
        fids = friendIdsOf(
          peerId,
          ((fsRows ?? []) as unknown[]) as {
            user_id: unknown;
            friend_id: unknown;
            status: unknown;
          }[],
        );
      }
      if (!canViewCheckin(peerId, post.user_id, post.visibility, fids)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      return apiError("forbidden", "對方無權查看這條打卡", 403);
    }
    attachments = [
      parsed.share.place === undefined
        ? { checkin_id: parsed.share.checkin_id }
        : { checkin_id: parsed.share.checkin_id, place: parsed.share.place },
    ];
  } else if (parsed.kind !== "text") {
    // UR D.10 陌生人会话只许 text＋share（image／audio 先关，降骚扰面）。
    if (!isFriend) {
      return apiError("invalid_params", "陌生会话只支持文字与打卡卡片", 400);
    }
    for (const a of parsed.attachments) {
      if (!a.path.startsWith(`${userId}/`)) {
        return apiError("invalid_params", "附件不屬於你", 400);
      }
    }
    const bucket = parsed.kind === "image" ? "chat-images" : "chat-voice";
    // D.8 文件存在性＋真实大小（service 查桶；缺档 400；超申报 ±10%→400＋删档）。
    // RLS 不拦 service；path 归属上已验首段是自己。
    const svc = await createServiceClient();
    for (const a of parsed.attachments) {
      const slash = a.path.indexOf("/");
      const found = await svc.storage
        .from(bucket)
        .list(a.path.slice(0, slash), { search: a.path.slice(slash + 1) });
      const hit = (found.data ?? []).find((f) => f.name === a.path.slice(slash + 1));
      const realSize =
        hit !== undefined && typeof hit.metadata?.size === "number" ? hit.metadata.size : NaN;
      if (!Number.isFinite(realSize)) {
        return apiError("invalid_params", "文件不存在或已删除", 400);
      }
      if (!isSizeWithin(realSize, a.bytes)) {
        await svc.storage.from(bucket).remove([a.path]);
        return apiError("invalid_params", "文件大小与申报不符", 400);
      }
    }
    attachments = parsed.attachments.map((a) => ({ ...a, bucket }));
  }
  // UR D.10 陌生人配额（对方最新消息后我的连续数；3 达线 429 stranger_quota；
  // 好友免检；四种全计，沿交接 §3.2）。
  let quotaUsed = 0;
  if (!isFriend) {
    const { data: recent } = await supabase
      .from("messages")
      .select("sender_id,created_at")
      .eq("conversation_id", parsedId.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const asc = (((recent ?? []) as unknown[]) as { sender_id: unknown; created_at: unknown }[])
      .filter(
        (m): m is { sender_id: string; created_at: string } =>
          typeof m.sender_id === "string" && typeof m.created_at === "string",
      )
      .reverse();
    quotaUsed = strangerQuota(asc, userId).used;
    if (quotaUsed >= STRANGER_MSG_LIMIT) {
      return apiError("stranger_quota", "對方未回覆前，你最多可以發 3 條", 429);
    }
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
    .select("id,sender_id,kind,body,attachments,created_at")
    .eq("conversation_id", parsedId.id)
    .eq("client_msg_id", parsed.client_msg_id)
    .maybeSingle();
  if (dup !== null) {
    const m = toChatMessage(dup, userId);
    if (m !== null) {
      return apiOk({
        message: m,
        duplicate: true,
        quota: isFriend
          ? null
          : {
              limit: STRANGER_MSG_LIMIT,
              used: quotaUsed,
              remaining: Math.max(0, STRANGER_MSG_LIMIT - quotaUsed),
            },
      });
    }
  }
  const { data: inserted, error: iErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsedId.id,
      sender_id: userId,
      kind: parsed.kind,
      // D.8 image caption 存 body；audio 恒 null；text 正文。
      body: parsed.kind === "text" ? parsed.body : parsed.kind === "image" ? parsed.body : null,
      attachments,
      client_msg_id: parsed.client_msg_id,
    })
    .select("id,sender_id,kind,body,attachments,created_at")
    .single();
  if (iErr !== null || inserted === null) {
    // 23505 併發撞鍵：回讀既有行（與上同，競態收斂）
    if (iErr?.code === "23505") {
      const { data: raced } = await supabase
        .from("messages")
        .select("id,sender_id,kind,body,attachments,created_at")
        .eq("conversation_id", parsedId.id)
        .eq("client_msg_id", parsed.client_msg_id)
        .maybeSingle();
      const m = toChatMessage(raced, userId);
      if (m !== null) {
        return apiOk({
          message: m,
          duplicate: true,
          quota: isFriend
            ? null
            : {
                limit: STRANGER_MSG_LIMIT,
                used: quotaUsed,
                remaining: Math.max(0, STRANGER_MSG_LIMIT - quotaUsed),
              },
        });
      }
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
  const usedAfter = isFriend ? 0 : quotaUsed + 1;
  return apiOk(
    {
      message,
      duplicate: false,
      quota: isFriend
        ? null
        : {
            limit: STRANGER_MSG_LIMIT,
            used: usedAfter,
            remaining: Math.max(0, STRANGER_MSG_LIMIT - usedAfter),
          },
    },
    201,
  );
}
