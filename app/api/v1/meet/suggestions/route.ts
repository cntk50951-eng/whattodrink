import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { pickSuggestionLang, SUGGESTION_MAX, type SuggestionItem } from "@/lib/meetSuggestions";

/**
 * 遇見「想找什麼」每日推薦語（🔒；iOS enhancement_nov2_01 #21）。
 * `GET /api/v1/meet/suggestions` → `{ suggestions: [{id,text,icon}], generated_at }`
 * 語言按 `Accept-Language`（zh-Hant／zh-Hans／en）；回「最近一批」。平台級內容，不含個人資料。
 * 還沒有任何一批（排程尚未跑過）→ 404 `not_found`，iOS 據此暫時沿用內置推薦語。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const lang = pickSuggestionLang(req.headers.get("accept-language"));
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("meet_suggestions")
    .select("items,created_at")
    .eq("lang", lang)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error !== null) {
    console.error(`[api/v1/meet/suggestions] read error: code=${error.code} message=${error.message}`);
    return apiError("internal", "推薦語讀取失敗", 500);
  }
  const row = data as { items: unknown; created_at: string } | null;
  if (row === null || !Array.isArray(row.items)) {
    return apiError("not_found", "推薦語尚未生成", 404);
  }
  const suggestions = (row.items as unknown[])
    .filter((x): x is SuggestionItem => {
      if (typeof x !== "object" || x === null) return false;
      const r = x as Record<string, unknown>;
      return typeof r.id === "string" && typeof r.text === "string" && typeof r.icon === "string";
    })
    .slice(0, SUGGESTION_MAX);
  if (suggestions.length === 0) {
    return apiError("not_found", "推薦語尚未生成", 404);
  }
  return apiOk({ suggestions, generated_at: Date.parse(row.created_at) });
}
