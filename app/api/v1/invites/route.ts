import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canViewCheckin } from "@/lib/api/checkins";
import { friendIdsOf, type FriendshipRow } from "@/lib/friends";
import { inviteWindow, parseInviteBody } from "@/lib/api/invites";

/** HK 今日 0 点 UTC ISO（3／天窗口下界，沿 cheers 口径）。 */
function hkDayStartISO(nowMs: number): string {
  const hk = new Date(nowMs + 8 * 3600_000);
  hk.setUTCHours(0, 0, 0, 0);
  return new Date(hk.getTime() - 8 * 3600_000).toISOString();
}

/**
 * UR E.16 发起＋收发箱（🔒，匿名 401；隐身发送 403）。
 * `POST /api/v1/invites {to_user_id, place, slot}` —— 3／天＋同对象 1／天；
 * 对方隐身／屏蔽中性 403（绝不写原因）；回 `{id, expires_at}`。
 * `GET /api/v1/invites?box=inbox|sent` —— 收（sent 待回＋accepted 未来到）／
 * 发（全行＋对方公开三列＋is_friend；陌生人分区由客户端按 is_friend 切）。
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
  const parsed = parseInviteBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // 定靶：checkin 解作者（可见门沿详情口径，不可见 404 不泄归属）；to_user 直用。
  let toUserId: string;
  if (parsed.checkin_id !== undefined) {
    const { data: postRaw } = await supabase
      .from("checkins")
      .select("id,user_id,visibility")
      .eq("id", parsed.checkin_id)
      .maybeSingle();
    const post = postRaw as { id: string; user_id: string | null; visibility: unknown } | null;
    if (post === null || post.user_id === null) {
      return apiError("not_found", "打卡不存在", 404);
    }
    if (post.visibility !== "public") {
      let fids: string[] = [];
      if (post.visibility === "friends") {
        const { data: fsRows } = await supabase
          .from("friendships")
          .select("user_id,friend_id,status")
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .limit(200);
        const rows = ((fsRows ?? []) as unknown[]).filter(
          (r): r is FriendshipRow =>
            typeof r === "object" && r !== null && "user_id" in (r as Record<string, unknown>),
        );
        fids = friendIdsOf(userId, rows);
      }
      if (!canViewCheckin(userId, post.user_id, post.visibility, fids)) {
        return apiError("not_found", "打卡不存在", 404);
      }
    }
    toUserId = post.user_id;
  } else {
    toUserId = parsed.to_user_id as string;
  }
  if (toUserId === userId) {
    return apiError("forbidden", "不可約自己", 403);
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode")
    .eq("id", userId)
    .maybeSingle();
  if ((meRow as { mode?: unknown } | null)?.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可約喝酒", 403);
  }
  const { data: peerRow } = await supabase
    .from("users")
    .select("id,mode")
    .eq("id", toUserId)
    .maybeSingle();
  if (peerRow === null) return apiError("not_found", "對方不存在", 404);
  const peer = peerRow as { id: string; mode?: unknown };
  if (peer.mode === "stealth") {
    return apiError("forbidden", "TA 暫時不接收邀請", 403);
  }
  const { data: blockRows } = await supabase
    .from("cheers_blocks")
    .select("blocker_id,blocked_id")
    .or(
      `and(blocker_id.eq.${peer.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${peer.id})`,
    )
    .limit(2);
  if (Array.isArray(blockRows) && blockRows.length > 0) {
    return apiError("forbidden", "TA 暫時不接收邀請", 403);
  }
  const dayStart = hkDayStartISO(Date.now());
  const { count: dayCount } = await supabase
    .from("drink_invites")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", userId)
    .gte("created_at", dayStart);
  if ((dayCount ?? 0) >= 3) {
    return apiError("rate_limited", "今日邀約已達上限（3 次）", 429);
  }
  const { count: pairCount } = await supabase
    .from("drink_invites")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", userId)
    .eq("to_user_id", peer.id)
    .gte("created_at", dayStart);
  if ((pairCount ?? 0) > 0) {
    return apiError("rate_limited", "今日已約過 TA，明天再來", 429);
  }
  const w = inviteWindow(parsed.slot, Date.now());
  const { data: inserted, error: iErr } = await supabase
    .from("drink_invites")
    .insert({
      from_user_id: userId,
      to_user_id: peer.id,
      checkin_id: parsed.checkin_id ?? null,
      place: parsed.place,
      start_at: new Date(w.startAt).toISOString(),
      expires_at: new Date(w.expiresAt).toISOString(),
      status: "sent",
    })
    .select("id,expires_at")
    .single();
  if (iErr !== null || inserted === null) {
    console.error(`[api/v1/invites] insert error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "邀約發送失敗", 500);
  }
  const row = inserted as { id: string; expires_at: string };
  return apiOk({ id: row.id, expires_at: row.expires_at });
}

type InviteRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  checkin_id: string | null;
  place: string;
  start_at: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
};

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const box = new URL(req.url).searchParams.get("box") === "sent" ? "sent" : "inbox";
  const col = box === "sent" ? "from_user_id" : "to_user_id";
  const { data: rows, error } = await supabase
    .from("drink_invites")
    .select("id,from_user_id,to_user_id,checkin_id,place,start_at,expires_at,status,created_at")
    .eq(col, userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error !== null) {
    console.error(`[api/v1/invites] read error: code=${error.code} message=${error.message}`);
    return apiError("internal", "邀約讀取失敗", 500);
  }
  const list = ((rows ?? []) as InviteRow[]).filter((r) => typeof r.id === "string");
  const peerIds = [
    ...new Set(list.map((r) => (box === "sent" ? r.to_user_id : r.from_user_id))),
  ];
  let peers = new Map<string, { nickname: string; avatar_url: string | null }>();
  let friendSet = new Set<string>();
  if (peerIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,nickname,avatar_url")
      .in("id", peerIds);
    peers = new Map(
      (((users ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null }[]).map(
        (u) => [u.id, { nickname: u.nickname, avatar_url: u.avatar_url }],
      ),
    );
    const { data: fsRows } = await supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .limit(200);
    const frows = ((fsRows ?? []) as unknown[]).filter(
      (r): r is FriendshipRow =>
        typeof r === "object" && r !== null && "user_id" in (r as Record<string, unknown>),
    );
    friendSet = new Set(friendIdsOf(userId, frows));
  }
  const items = list.map((r) => {
    const pid = box === "sent" ? r.to_user_id : r.from_user_id;
    const peer = peers.get(pid) ?? { nickname: "酒友", avatar_url: null };
    return {
      id: r.id,
      peer: { user_id: pid, nickname: peer.nickname, avatar_url: peer.avatar_url },
      place: r.place,
      checkin_id: r.checkin_id,
      start_at: r.start_at,
      expires_at: r.expires_at,
      status: r.status,
      created_at: r.created_at,
      is_friend: friendSet.has(pid),
    };
  });
  const pending = list.filter((r) => r.status === "sent").length;
  return apiOk({ items, pending });
}
