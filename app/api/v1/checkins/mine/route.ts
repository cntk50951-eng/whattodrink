import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseMineParams, toMineRow } from "@/lib/api/checkins";

/**
 * UR A.10 二次登录回显（🔒 需登录）。
 * `GET /api/v1/checkins/mine?limit=30` -> 回自己 `type=want` 的打卡（倒序，截断后返），前端拼成 WantRecord 历史。
 * RLS 靠 0006 `checkins owner read`（`auth.uid()=user_id`），此口不额外加 visibility 过滤（private 也回，自己看）。
 */

const MINE_COLUMNS = "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,beers(id,name,emoji,category,tagline,icon_url)";

export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }

  const parsed = parseMineParams(new URL(req.url).searchParams);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { limit } = parsed;

  try {
    let rows: unknown[] | null = null;
    {
      const { data, error } = await supabase
        .from("checkins")
        .select(MINE_COLUMNS)
        .eq("user_id", userId)
        .eq("type", "want")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error === null) {
        rows = (data ?? []) as unknown[];
      } else if (error.code === "42703") {
        console.warn("[api/v1/checkins/mine] 0007 未遷移，回退舊列");
        const { data: legacyData, error: legacyErr } = await supabase
          .from("checkins")
          .select("id,beer_id,lat,lng,place_name,created_at,beers(id,name,emoji,category,tagline,icon_url)")
          .eq("user_id", userId)
          .eq("type", "want")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (legacyErr) {
          console.error(`[api/v1/checkins/mine] legacy supabase error: code=${legacyErr.code} message=${legacyErr.message}`);
          return apiError("internal", "打卡读取失败", 500);
        }
        // 舊行補 kind/visibility/expires_at 默認
        rows = ((legacyData ?? []) as unknown[]).map((r) => {
          const rec = r as Record<string, unknown>;
          return { ...rec, kind: "flash", visibility: "private", expires_at: null };
        });
      } else {
        console.error(`[api/v1/checkins/mine] supabase error: code=${error.code} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""}`);
        return apiError("internal", "打卡读取失败", 500);
      }
    }
    if (rows === null) rows = [];

    let skipped = 0;
    const checkins = [];
    for (const row of rows) {
      const mapped = toMineRow(row);
      if (mapped === null) {
        skipped += 1;
        continue;
      }
      checkins.push(mapped);
    }
    if (skipped > 0) {
      console.warn(`[api/v1/checkins/mine] skipped ${skipped} malformed rows`);
    }

    // DB 是倒序（新在前），WantHistory 要升序（旧在前），这里原序返，前端可直接 `slice(-30).sort(at)` 或保持倒序后翻；
    // 统一返倒序，前端按需翻（DrinkMap 当前 history 是升序，调用处自行翻或重排）
    return apiOk({ checkins });
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
