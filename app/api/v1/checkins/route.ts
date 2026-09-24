import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCreateCheckinBody } from "@/lib/api/checkins";

/**
 * UR A.12 打卡雙類型（🔒，承 A.10）。
 * `POST /api/v1/checkins {beer_id, lat, lng, place_name?, kind}` -> 插 `checkins(type=want, kind, visibility deriv. from users.mode, expires_at)`。
 * 隱身模式直接 403，前端引導切換；未傳 kind 兼容為 flash。
 */

const CHECKIN_SELECT = "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at";

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

  const parsed = parseCreateCheckinBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { beer_id, lat, lng, place_name, kind } = parsed.body;

  try {
    // 取用戶模式派生 visibility；隱身直接 403（A.12 模式權限）。0007 未遷移時 users.mode 缺列，按 public 回退
    let mode: string = "public";
    try {
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("mode")
        .eq("id", userId)
        .maybeSingle();
      if (userErr) {
        // 42703 未遷移時 users.mode 缺列，視為 public
        if (userErr.code === "42703") {
          mode = "public";
        } else {
          console.error(`[api/v1/checkins] user mode lookup error: code=${userErr.code} message=${userErr.message}`);
          return apiError("internal", "用户模式读取失败", 500);
        }
      } else {
        mode = (userRow as { mode?: string } | null)?.mode ?? "public";
      }
    } catch {
      mode = "public";
    }
    if (mode === "stealth") {
      return apiError("forbidden", "隱身模式不可打卡，請切換至好友或公開模式", 403);
    }
    const visibility = mode === "friends" ? "friends" : "public";
    const expiresAt = kind === "flash" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    // 先校验 beer_id 是否存在（FK 不存在会 500，提前转 400 更友好；并发竞态下仍可能落 FK，故容错两路）
    const { data: beerExists, error: beerErr } = await supabase
      .from("beers")
      .select("id")
      .eq("id", beer_id)
      .maybeSingle();
    if (beerErr) {
      console.error(
        `[api/v1/checkins] beer lookup error: code=${beerErr.code} message=${beerErr.message}`,
      );
      return apiError("internal", "beer 校验失败", 500);
    }
    if (beerExists === null) {
      return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
    }

    let inserted: Record<string, unknown> | null = null;
    {
      const { data, error } = await supabase
        .from("checkins")
        .insert({
          user_id: userId,
          beer_id,
          lat,
          lng,
          place_name: place_name ?? null,
          type: "want",
          kind,
          visibility,
          expires_at: expiresAt,
        })
        .select(CHECKIN_SELECT)
        .single();
      if (error === null && data !== null) {
        inserted = data as unknown as Record<string, unknown>;
      } else {
        // 0007 未遷移時 kind/visibility/expires_at 缺列（42703），回退舊插入（private）
        if (error?.code === "42703") {
          console.warn("[api/v1/checkins] 0007 未遷移，回退舊插入");
          const { data: legacyData, error: legacyErr } = await supabase
            .from("checkins")
            .insert({
              user_id: userId,
              beer_id,
              lat,
              lng,
              place_name: place_name ?? null,
              type: "want",
              visibility: "private",
            })
            .select("id,beer_id,lat,lng,place_name,created_at")
            .single();
          if (legacyErr || legacyData === null) {
            const isFk = legacyErr?.code === "23503";
            if (isFk) return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
            console.error(`[api/v1/checkins] legacy insert error: code=${legacyErr?.code} message=${legacyErr?.message}`);
            return apiError("internal", "打卡落库失败", 500);
          }
          const r = legacyData as unknown as Record<string, unknown>;
          return apiOk(
            {
              checkin: {
                id: r.id as string,
                beer_id: r.beer_id as string,
                lat: r.lat as number,
                lng: r.lng as number,
                place_name: r.place_name as string | null,
                kind,
                visibility: "private" as const,
                expires_at: expiresAt,
                created_at: r.created_at as string,
              },
            },
            201,
          );
        }
        const isFk = error?.code === "23503";
        if (isFk) return apiError("invalid_params", `beer_id 不存在：${beer_id}`, 400);
        console.error(`[api/v1/checkins] insert error: code=${error?.code} message=${error?.message} details=${error?.details ?? ""}`);
        return apiError("internal", "打卡落库失败", 500);
      }
    }
    const row = inserted as Record<string, unknown>;
    return apiOk(
      {
        checkin: {
          id: row.id as string,
          beer_id: row.beer_id as string,
          lat: row.lat as number,
          lng: row.lng as number,
          place_name: row.place_name as string | null,
          kind: row.kind as "flash" | "post",
          visibility: row.visibility as "private" | "public" | "friends",
          expires_at: row.expires_at as string | null,
          created_at: row.created_at as string,
        },
      },
      201,
    );
  } catch (err) {
    return apiError("internal", err instanceof Error ? err.message : "unknown", 500);
  }
}
