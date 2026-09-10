import { createClient } from "@/lib/supabase/server";
import { toBeersJson } from "@/lib/api/beers";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * UR A.3 第一個 API：酒目錄公開讀（A.4-1）。
 * 匿名可調、無參數、15 行靜態表。RLS 靠 `0002_beers_policy.sql`
 * （beers SELECT 公開）；policy 沒開時這裡 500 炸出來，不靜默空表。
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("beers")
      .select("id,emoji,name,category,tagline,icon_url")
      .order("id");
    if (error) {
      // 診斷口：真因（表不存在／key 錯／policy 語法）全在這行，貼回來即定位。
      console.error(
        `[api/v1/beers] supabase error: code=${error.code} message=${error.message} details=${error.details ?? ""} hint=${error.hint ?? ""}`,
      );
      return apiError("internal", "beers 讀取失敗", 500);
    }
    const beers = toBeersJson(data);
    if (beers === null) {
      return apiError("internal", "beers 數據形狀異常", 500);
    }
    return apiOk({ beers });
  } catch (err) {
    return apiError(
      "internal",
      err instanceof Error ? err.message : "unknown",
      500,
    );
  }
}
