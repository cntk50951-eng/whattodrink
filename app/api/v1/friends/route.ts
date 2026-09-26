import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { areFriends, parseAddFriendBody } from "@/lib/friends";

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
      });
      if (insErr) {
        // 並發競態撞 UNIQUE：重讀走同分支一次（冪等），再撞即 500
        if (insErr.code === "23505" && !retried) return decide(true);
        console.error(`[api/v1/friends] insert error: code=${insErr.code} message=${insErr.message}`);
        return apiError("internal", "好友邀請失敗", 500);
      }
      return apiOk({ status: "pending" as const }, 201);
    };
    return await decide(false);
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
