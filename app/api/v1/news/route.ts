import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { newsLimit, type NewsRegion } from "@/lib/api/news";

const REGIONS: NewsRegion[] = ["hk", "cn", "both"];

/**
 * UR E.24 酒闻列表（🌐匿名可看；iOS-0.59 联调）。
 * `GET /api/v1/news?region=hk|cn|both&limit=&cursor=` —— region 缺省 hk，
 * 严格相等（hk 只回 hk，both 另查）；published_at 倒序；cursor＝published_at ISO。
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const regionRaw = (q.get("region") ?? "hk").trim().toLowerCase();
  if (!(REGIONS as string[]).includes(regionRaw)) {
    return apiError("invalid_params", "region 只要 hk｜cn｜both", 400);
  }
  const region = regionRaw as NewsRegion;
  const limit = newsLimit(q.get("limit"));
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;

  const { supabase } = await getAuthedClient(req);
  let query = supabase
    .from("booze_news")
    .select("id,title,snippet,source,source_url,image_url,published_at,region")
    .eq("region", region)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (Number.isFinite(cursorMs)) {
    query = query.lt("published_at", new Date(cursorMs).toISOString());
  }
  const { data: rows, error } = await query;
  if (error !== null) {
    console.error(`[api/v1/news] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "酒闻读取失败", 500);
  }
  return apiOk({ items: rows ?? [] });
}
