import { createClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { friendIdsOf } from "@/lib/friends";
import {
  WALL_HOT_WINDOW_CAP,
  WALL_HOT_WINDOW_MS,
  dropAboveHotCursor,
  hotCursorOf,
  latestCursorOf,
  parseWallParams,
  sortHotPosts,
  toWallPost,
  encodeCursor,
  type WallPostJson,
} from "@/lib/api/wall";

/**
 * UR A.6 公開牆（A.4-2，🌐 免登入）。
 * 只吐 `visibility=public` 行＋公開列（RLS 第二道鎖見
 * `0005_checkins_wall_policy.sql`，route 自身不過濾私密——查的就是公開子集）。
 * server client 是 anon 身份：policy 沒開時這裡靜默空牆，所以空結果帶
 * `X-Wall-Empty: 1` 頭方便排障？不——保持包絡乾淨，空牆就是空數組；
 * 真出錯（表不存在／key 錯）走 500＋console 診斷行（沿 beers 梯子）。
 */

const WALL_COLUMNS =
  "id,photo_url,note,transcript,audio_url,audio_seconds,created_at,users(nickname,avatar_url,gender),post_likes(count)";

export async function GET(req: Request) {
  const parsed = parseWallParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { sort, limit, cursor, scope } = parsed.params;

  // UR A.17 只看好友：需登入，限定 accepted 好友的 friends＋public 行。
  // 無好友即空牆（不下空集查詢，直接回）。
  let supabase = await createClient();
  let visibilities: string[] = ["public"];
  let authorIds: string[] | null = null;
  if (scope === "friends") {
    const authed = await getAuthedClient(req);
    if (authed.userId === null) {
      return apiError("unauthorized", "未登录", 401);
    }
    const { data: fsRows, error: fsErr } = await authed.supabase
      .from("friendships")
      .select("user_id,friend_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${authed.userId},friend_id.eq.${authed.userId}`);
    if (fsErr) {
      console.error(`[api/v1/wall] friendships error: code=${fsErr.code} message=${fsErr.message}`);
      return apiError("internal", "好友查詢失敗", 500);
    }
    const friendIds = friendIdsOf(
      authed.userId,
      (fsRows ?? []) as { user_id: unknown; friend_id: unknown; status: unknown }[],
    );
    if (friendIds.length === 0) {
      return apiOk({ posts: [], nextCursor: null });
    }
    supabase = authed.supabase;
    visibilities = ["friends", "public"];
    authorIds = friendIds;
  }

  try {
    let rows: unknown[];
    if (sort === "latest") {
      let query = supabase
        .from("checkins")
        .select(WALL_COLUMNS)
        .in("visibility", visibilities)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (authorIds !== null) {
        query = query.in("user_id", authorIds);
      }
      if (cursor !== null) {
        query = query.or(
          `created_at.lt.${cursor.ca},and(created_at.eq.${cursor.ca},id.lt.${cursor.id})`,
        );
      }
      const { data, error } = await query;
      if (error) {
        console.error(
          `[api/v1/wall] supabase error: code=${error.code} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""}`,
        );
        return apiError("internal", "wall 讀取失敗", 500);
      }
      rows = (data ?? []) as unknown[];
    } else {
      const cutoff = new Date(Date.now() - WALL_HOT_WINDOW_MS).toISOString();
      let query = supabase
        .from("checkins")
        .select(WALL_COLUMNS)
        .in("visibility", visibilities)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(WALL_HOT_WINDOW_CAP);
      if (authorIds !== null) {
        query = query.in("user_id", authorIds);
      }
      const { data, error } = await query;
      if (error) {
        console.error(
          `[api/v1/wall] supabase error: code=${error.code} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""}`,
        );
        return apiError("internal", "wall 讀取失敗", 500);
      }
      rows = (data ?? []) as unknown[];
    }

    let skipped = 0;
    const mapped: WallPostJson[] = [];
    for (const row of rows) {
      const post = toWallPost(row);
      if (post === null) {
        skipped += 1;
        continue;
      }
      mapped.push(post);
    }
    if (skipped > 0) {
      console.warn(`[api/v1/wall] skipped ${skipped} malformed rows`);
    }

    let ordered: WallPostJson[];
    if (sort === "hot") {
      const sorted = sortHotPosts(mapped);
      ordered =
        cursor !== null && cursor.sort === "hot"
          ? dropAboveHotCursor(sorted, cursor)
          : sorted;
    } else {
      ordered = mapped;
    }
    const page = ordered.slice(0, limit);
    const hasMore = ordered.length > limit;
    const last = page[page.length - 1];
    return apiOk({
      posts: page,
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor(
              sort === "hot" ? hotCursorOf(last) : latestCursorOf(last),
            )
          : null,
    });
  } catch (err) {
    return apiError(
      "internal",
      err instanceof Error ? err.message : "unknown",
      500,
    );
  }
}
