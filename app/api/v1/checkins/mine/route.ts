import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseMineParams, toMineRow } from "@/lib/api/checkins";

/**
 * UR A.10 二次登录回显（🔒 需登录）。
 * `GET /api/v1/checkins/mine?limit=30` -> 回自己 `type=want` 的打卡（倒序，截断后返），前端拼成 WantRecord 历史。
 * RLS 靠 0006 `checkins owner read`（`auth.uid()=user_id`），此口不额外加 visibility 过滤（private 也回，自己看）。
 */

const MINE_COLUMNS = "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,tags,beers(id,name,emoji,category,tagline,icon_url)";

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
    // UR E.22 歸檔聯查（足跡回看不斷；歸檔行同列＋beers 手拼；同 id 去重主表优先；
    // 歸檔表未遷移即靜默跳過，主表照回，沿 42703 回退口徑）。
    // iOS-0.68 定案（主嫌实锤）：checkins_archive 零 FK（0026 刻意审计不断链），
    // PostgREST 内嵌 beers(...) 无关系可走即 PGRST200 整查失败——故归档只选平列，
    // beer 另查一次手动拼（形状与主表行一致）；出错 warn 不静默。
    const ARCHIVE_COLUMNS =
      "id,beer_id,lat,lng,place_name,kind,visibility,expires_at,created_at,photo_url,note,audio_url,audio_seconds,transcript,tags";
    try {
      const { data: archived, error: archErr } = await supabase
        .from("checkins_archive")
        .select(ARCHIVE_COLUMNS)
        .eq("user_id", userId)
        .eq("type", "want")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (archErr !== null) {
        console.warn(`[api/v1/checkins/mine] archive skipped: code=${archErr.code} message=${archErr.message}`);
      } else if (Array.isArray(archived)) {
        const archRows = (archived as unknown[]).filter(
          (r): r is Record<string, unknown> => typeof r === "object" && r !== null,
        );
        // beers 手拼（归档无 FK 不可 embed；id 集合一次查，坏酒行留 null 沿 toMineRow 容错）。
        const beerIds = [
          ...new Set(
            archRows.map((r) => r.beer_id).filter((id): id is string => typeof id === "string" && id !== ""),
          ),
        ];
        const beerById = new Map<string, Record<string, unknown>>();
        if (beerIds.length > 0) {
          const { data: beerRows } = await supabase
            .from("beers")
            .select("id,name,emoji,category,tagline,icon_url")
            .in("id", beerIds);
          for (const b of ((beerRows ?? []) as unknown[])) {
            if (typeof b !== "object" || b === null) continue;
            const rec = b as Record<string, unknown>;
            if (typeof rec.id === "string") beerById.set(rec.id, rec);
          }
        }
        const seen = new Set(
          rows.map((r) => (r as Record<string, unknown>).id).filter((id) => typeof id === "string"));
        const merged = [...rows];
        for (const r of archRows) {
          const id = r.id;
          if (typeof id === "string" && !seen.has(id)) {
            seen.add(id);
            const bid = typeof r.beer_id === "string" ? r.beer_id : null;
            merged.push({
              ...r,
              kind: r.kind ?? "flash",
              visibility: r.visibility ?? "private",
              beers: bid !== null ? (beerById.get(bid) ?? null) : null,
            });
          }
        }
        merged.sort((a, b) => {
          const ca = (a as Record<string, unknown>).created_at;
          const cb = (b as Record<string, unknown>).created_at;
          if (typeof ca !== "string" || typeof cb !== "string") return 0;
          return cb < ca ? -1 : cb > ca ? 1 : 0;
        });
        // iOS-0.68 切片定案：双段全返（主表 ≤limit＋归档 ≤limit，不再 slice(0, limit) 切旧行；
        // 同形状， bounded 2*limit，iOS 照单吃）。
        rows = merged;
      }
    } catch (err) {
      console.warn(`[api/v1/checkins/mine] archive threw: ${err instanceof Error ? err.message : "unknown"}`);
    }

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
