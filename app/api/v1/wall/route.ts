import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
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
  const { sort, limit, cursor } = parsed.params;

  try {
    const supabase = await createClient();
    let rows: unknown[];
    if (sort === "latest") {
      let query = supabase
        .from("checkins")
        .select(WALL_COLUMNS)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
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
      const { data, error } = await supabase
        .from("checkins")
        .select(WALL_COLUMNS)
        .eq("visibility", "public")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(WALL_HOT_WINDOW_CAP);
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
