import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, friendIdsOf, parseAddFriendBody, parseRequestOrigin, toFriendListItem } from "@/lib/friends";
import { sendFriendPush } from "@/lib/push/send";

/**
 * DEF-20260926-009＋UR A.19：最小好友邀請（🔒，V1 無接受 UI）。
 * `POST /api/v1/friends {friend_id} | {checkin_id}`（二選一，後者 server 解作者）：
 * - 已接受（任一方向）→ 200 `{status:"accepted"}`（冪等，不重插）
 * - 對方加過我（反向 pending）→ 雙翻 accepted → 200（雙向 opt-in 即成好友）
 * - 僅我方 pending／無 → 回／插 pending（`{status:"pending"}`，新建 201）
 * 並發撞 UNIQUE(23505) → 重讀走同分支。RLS 沿 0010（發起＋翻轉）。
 */

type RawFriendship = {
  user_id: unknown;
  friend_id: unknown;
  status: unknown;
};

async function ensureUserRow(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
): Promise<void> {
  // 缺行自建沿 DEF-20250925-001（POST /checkins、GET /me 同配方）。
  try {
    const { data: ensured } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (ensured !== null) return;
    await supabase
      .from("users")
      .insert({ id: userId, nickname: "酒友", gender: "secret" });
  } catch {}
}

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
  const parsed = parseAddFriendBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  // 解目標 user id（checkin 走 server 解，行不可見即 404）
  let targetUserId: string;
  if ("friendId" in parsed.body) {
    targetUserId = parsed.body.friendId;
  } else {
    try {
      const { data: row, error: rowErr } = await supabase
        .from("checkins")
        .select("user_id")
        .eq("id", parsed.body.checkinId)
        .maybeSingle();
      if (rowErr || row === null) {
        if (rowErr) {
          console.error(`[api/v1/friends] checkin lookup error: code=${rowErr.code} message=${rowErr.message}`);
        }
        return apiError("not_found", "對象不存在", 404);
      }
      const author = (row as unknown as { user_id: unknown }).user_id;
      if (typeof author !== "string") {
        return apiError("not_found", "對象不存在", 404);
      }
      targetUserId = author;
    } catch (err) {
      return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
    }
  }
  if (targetUserId === userId) {
    return apiError("invalid_params", "不可加自己為好友", 400);
  }
  // UR B.3 拉黑任一方不可发（404 不泄；走 service，反向行 authed 不可见）。
  {
    const blockSvc = await createServiceClient();
    const { data: blockRows } = await blockSvc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${userId})`)
      .limit(1);
    if (Array.isArray(blockRows) && blockRows.length > 0) {
      return apiError("not_found", "對象不存在", 404);
    }
  }
  // UR B.3 每日新请求 20 个（HK 天，防骚扰）。
  {
    const hk = new Date(Date.now() + 8 * 3600_000);
    hk.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(hk.getTime() - 8 * 3600_000).toISOString();
    const { count: dayCount } = await supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayStart);
    if ((dayCount ?? 0) >= 20) {
      return apiError("rate_limited", "今日好友請求已達上限", 429);
    }
  }

  try {
    await ensureUserRow(supabase, userId);
    const decide = async (retried: boolean): Promise<Response> => {
      const { data, error } = await supabase
        .from("friendships")
        .select("user_id,friend_id,status")
        .or(
          `and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`,
        )
        .limit(5);
      if (error) {
        console.error(`[api/v1/friends] read error: code=${error.code} message=${error.message}`);
        return apiError("internal", "好友查詢失敗", 500);
      }
      const rows = (data ?? []) as RawFriendship[];
      if (areFriends(userId, targetUserId, rows)) {
        return apiOk({ status: "accepted" as const });
      }
      const reversePending = rows.some(
        (r) =>
          r.status === "pending" &&
          r.user_id === targetUserId &&
          r.friend_id === userId,
      );
      if (reversePending) {
        // 對方加過我：雙翻 accepted（雙向 opt-in，無需接受 UI）
        const { error: flipErr } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("status", "pending")
          .or(
            `and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`,
          );
        if (flipErr) {
          console.error(`[api/v1/friends] flip error: code=${flipErr.code} message=${flipErr.message}`);
          return apiError("internal", "好友接受失敗", 500);
        }
        return apiOk({ status: "accepted" as const });
      }
      const myPending = rows.some(
        (r) =>
          r.status === "pending" &&
          r.user_id === userId &&
          r.friend_id === targetUserId,
      );
      if (myPending) {
        return apiOk({ status: "pending" as const });
      }
      const { error: insErr } = await supabase.from("friendships").insert({
        user_id: userId,
        friend_id: targetUserId,
        status: "pending",
        origin: "checkinId" in parsed.body ? "checkin" : parseRequestOrigin((raw as Record<string, unknown>).origin),
        source_checkin_id: "checkinId" in parsed.body ? parsed.body.checkinId : null,
      });
      if (insErr) {
        // 並發競態撞 UNIQUE：重讀走同分支一次（冪等），再撞即 500
        if (insErr.code === "23505" && !retried) return decide(true);
        console.error(`[api/v1/friends] insert error: code=${insErr.code} message=${insErr.message}`);
        return apiError("internal", "好友邀請失敗", 500);
      }
      // UR B.3 新请求推送（after 语义；失败不影响请求本身）。
      after(() => {
        void sendFriendPush("request", { fromUserId: userId, toUserId: targetUserId });
      });
      return apiOk({ status: "pending" as const }, 201);
    };
    return await decide(false);
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}

/**
 * UR D.4 好友列表（🔒）。
 * `GET /api/v1/friends` —— accepted 互好友全量（在線＋離線都要，排序由客戶端按末信排；
 * 只吐四列：精確坐標永不進列表，一鍵定位走地圖深鏈用 live 數據，隱私分離）。
 */
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { data: fsRows } = await supabase
    .from("friendships")
    .select("user_id,friend_id,status")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  const ids = friendIdsOf(
    userId,
    ((fsRows ?? []) as unknown[]) as {
      user_id: unknown;
      friend_id: unknown;
      status: unknown;
    }[],
  );
  if (ids.length === 0) return apiOk({ friends: [] });
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id,nickname,avatar_url,mode,last_seen_at")
    .in("id", ids);
  if (uErr !== null) {
    console.error(`[api/v1/friends] list error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "读取好友失败", 500);
  }
  const nowMs = Date.now();
  const friends = [];
  for (const row of (users ?? []) as unknown[]) {
    const f = toFriendListItem(row, nowMs);
    if (f !== null) friends.push(f);
  }
  return apiOk({ friends });
}

/**
 * UR B.3 解除好友（🔒，微信式）。
 * `DELETE /api/v1/friends {friend_id}` —— 删双向全部行（relationship 回 none；
 * 重加必须从零发请求经对方同意）＋双向 cheers_blocks 禁言（相互不可再发消息，
 * 聊天列表保留；重加须先 unblock，见 DELETE /cheers/blocks）。
 * 幂等（无行也 200）。写走 service（friendships 无 DELETE policy；
 * 反向拉黑行 blocker 非本人，authed WITH CHECK 过不了；user 限域全代码判）。
 */
export async function DELETE(req: Request): Promise<Response> {
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
  const fid = (raw as Record<string, unknown>).friend_id;
  if (typeof fid !== "string" || fid === "" || fid === userId || fid.length > 64) {
    return apiError("invalid_params", "friend_id 非法", 400);
  }
  const svc = await createServiceClient();
  const { error } = await svc
    .from("friendships")
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${fid}),and(user_id.eq.${fid},friend_id.eq.${userId})`);
  if (error !== null) {
    console.error(`[api/v1/friends] remove error: code=${error.code} message=${error.message}`);
    return apiError("internal", "解除好友失败", 500);
  }
  // 双向禁言（service 写，见上；失败记 log 不拦主流程）。
  const { error: bErr } = await svc.from("cheers_blocks").upsert(
    [
      { blocker_id: userId, blocked_id: fid },
      { blocker_id: fid, blocked_id: userId },
    ],
    { onConflict: "blocker_id,blocked_id" },
  );
  if (bErr !== null) {
    console.error(`[api/v1/friends] unblock-guard error: code=${bErr.code} message=${bErr.message}`);
  }
  return apiOk({ removed: true });
}
