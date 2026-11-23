import { apiError, apiOk } from "@/lib/api/envelope";
import {
  filterActiveNotices,
  normalizeNoticeLocale,
  parseNoticePlatform,
  type RawSystemNoticeRow,
} from "@/lib/api/systemNotices";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * 系統消息與版本更新下發（0080；匿名與已登入皆可讀，無需登入即可檢查強制升級）：
 * GET /api/v1/system/notices?platform=ios|android&version=1.4.2&locale=zh-HK
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const platform = parseNoticePlatform(q.get("platform"));
  if (platform === null) {
    return apiError("invalid_params", "platform 必須為 ios 或 android", 400);
  }
  const version = q.get("version")?.trim() || null;
  const locale = normalizeNoticeLocale(q.get("locale") ?? req.headers.get("accept-language"));

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("system_notices")
    .select(
      "id,kind,severity,platforms,max_version,version_label,title_zh_hant,title_zh_hans,title_en,body_zh_hant,body_zh_hans,body_en,bullets,cta_label_zh_hant,cta_label_zh_hans,cta_label_en,cta_url,published,starts_at,ends_at",
    )
    .eq("published", true)
    .order("starts_at", { ascending: false })
    .limit(30);

  if (error !== null) {
    // 遷移 0080 未執行前降級回空陣列，不阻斷客戶端啟動
    if (error.code === "42P01") {
      return apiOk({ notices: [] });
    }
    console.error(`[api/v1/system/notices] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "系統消息讀取失敗", 500);
  }

  const notices = filterActiveNotices((data ?? []) as RawSystemNoticeRow[], {
    platform,
    version,
    locale,
  });
  const res = apiOk({ notices });
  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  return res;
}
