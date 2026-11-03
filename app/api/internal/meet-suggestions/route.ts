import { createServiceClient } from "@/lib/supabase/server";
import { MINIMAX_CHAT_MODEL, minimaxChat } from "@/lib/minimax";
import {
  buildSuggestionPrompt,
  hkDay,
  hkHour,
  sanitizeSuggestions,
  statsFromCheckins,
  STATS_WINDOW_DAYS,
  SUGGESTION_LANGS,
} from "@/lib/meetSuggestions";

/**
 * 排程：每天（香港 05:00）為每種語言生成遇見「想找什麼」推薦語並落表 `meet_suggestions`。
 * 僅供 Vercel Cron 調用（vercel.json）：帶 `Authorization: Bearer $CRON_SECRET`；未配 CRON_SECRET 一律拒絕。
 * 輸入：最近 20 天**公開**打卡的聚合（熱門地點、晚間占比），不取個人資料。
 * 任一語言失敗不影響其他語言，也不覆蓋昨天那批（接口永遠回最近一批）。不在 /api/v1 契約內。
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret.length < 16) {
    return Response.json({ error: "cron not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.minimaxi_api_key ?? "";
  if (apiKey === "") {
    console.error("[meet-suggestions] missing minimaxi_api_key");
    return Response.json({ error: "llm not configured" }, { status: 503 });
  }
  try {
    const svc = await createServiceClient();
    const now = new Date();
    const day = hkDay(now);
    const since = new Date(now.getTime() - STATS_WINDOW_DAYS * 24 * 3600_000).toISOString();
    const { data: rows } = await svc
      .from("checkins")
      .select("place_name,created_at")
      .eq("visibility", "public")
      .gte("created_at", since)
      .limit(5000);
    const stats = statsFromCheckins(
      ((rows ?? []) as { place_name: string | null; created_at: string | null }[]),
      hkHour,
    );
    const result: Record<string, "ok" | "skipped" | "failed"> = {};
    for (const lang of SUGGESTION_LANGS) {
      try {
        const { system, user } = buildSuggestionPrompt(lang, stats);
        const reply = await minimaxChat(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          { apiKey, maxTokens: 500, temperature: 0.9 },
        );
        const items = sanitizeSuggestions(reply, day);
        if (items === null) {
          result[lang] = "skipped"; // 回覆不合格：保留昨天那批
          continue;
        }
        const { error } = await svc
          .from("meet_suggestions")
          .upsert({ day, lang, items, model: MINIMAX_CHAT_MODEL }, { onConflict: "day,lang" });
        result[lang] = error === null ? "ok" : "failed";
        if (error !== null) console.error(`[meet-suggestions] upsert ${lang}: ${error.code} ${error.message}`);
      } catch (err) {
        console.error(`[meet-suggestions] ${lang}: ${err instanceof Error ? err.message : "unknown"}`);
        result[lang] = "failed";
      }
    }
    return Response.json({ day, checkins: stats.checkinCount, result });
  } catch (err) {
    console.error(`[meet-suggestions] ${err instanceof Error ? err.message : "unknown"}`);
    return Response.json({ error: "generation failed" }, { status: 500 });
  }
}
