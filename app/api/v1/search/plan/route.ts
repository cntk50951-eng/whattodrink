import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import { minimaxChat } from "@/lib/minimax";
import { MEET_DAILY_LIMIT, MEET_LLM_TIMEOUT_MS, meetCriteriaSchemaText } from "@/lib/meet";
import { PLAN_QUERY_MAX, type PlanStage, parsePlanReply, planStreamLine, sanitizePlan, searchPlanPrompt, wantsPlanStream } from "@/lib/searchPlan";
import type { ApiErrorCode } from "@/lib/api/envelope";
import { hkDayStartISO } from "@/lib/api/party";

/**
 * 遇見智能搜索·計劃（🔒）：`POST {query}` → `{intents[], ignored[], remaining_today}`。
 * 一句話被 LLM 拆成 1–4 類意圖（people／places／parties／posts，每類字段白名單校驗）；
 * 真正的查詢由客戶端用既有接口／高德執行（找人走 /meet/search {criteria}，不再扣次數）。
 * 扣次數＝與遇見共用每日額度（HK 自然日 10 次，解析成功才扣）；審核＝沿 meet；LLM 失敗不扣。
 * 可選進度流：body `stream:true`（或 Accept: application/x-ndjson）→ NDJSON 事件（stage／result／error，見 lib/searchPlan.ts），
 * 讓客戶端顯示「審核中／理解中」；不帶就是原來的單個 JSON。
 */
type PlanOutcome =
  | { ok: true; data: { intents: unknown; ignored: string[]; remaining_today: number } }
  | { ok: false; code: ApiErrorCode; message: string; status: number };

export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query === "") return apiError("invalid_params", "query 必填", 400);
  if (Array.from(query).length > PLAN_QUERY_MAX) return apiError("invalid_params", `query 最长 ${PLAN_QUERY_MAX} 字`, 400);

  const stream = wantsPlanStream(body, req.headers.get("accept"));
  if (!stream) {
    const out = await runPlan(userId, query, () => {});
    return out.ok ? apiOk(out.data) : apiError(out.code, out.message, out.status);
  }
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (line: string): void => controller.enqueue(enc.encode(line));
        try {
          const out = await runPlan(userId, query, (stage) => send(planStreamLine({ event: "stage", stage })));
          send(planStreamLine(out.ok ? { event: "result", data: out.data } : { event: "error", code: out.code, message: out.message, status: out.status }));
        } catch (err) {
          console.error(`[search/plan] stream error: ${err instanceof Error ? err.message : "unknown"}`);
          send(planStreamLine({ event: "error", code: "ai_unavailable", message: "AI 暫時唔可用，請稍後再試", status: 503 }));
        } finally {
          controller.close();
        }
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } },
  );
}

async function runPlan(userId: string, query: string, onStage: (s: PlanStage) => void): Promise<PlanOutcome> {
  onStage("moderating");
  const verdict = await moderateCheckin(
    { text: query },
    {
      openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
      minimaxKey: process.env.minimaxi_api_key,
      minimaxBaseUrl: process.env.MINIMAX_API_BASE,
    },
  );
  const action = moderationAction(verdict);
  if (action === "reject") return { ok: false, code: "rejected", message: "內容未通過審核（搜尋描述），請修改後再發", status: 403 };
  if (action === "unavailable") return { ok: false, code: "rejected", message: "審核服務暫不可用，請稍後再試", status: 503 };

  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: meRow } = await svc.from("users").select("meet_search_date,meet_search_count").eq("id", userId).maybeSingle();
  const me = (meRow ?? {}) as Record<string, unknown>;
  const dayStart = hkDayStartISO(nowMs).slice(0, 10);
  const sameDay = typeof me.meet_search_date === "string" && me.meet_search_date >= dayStart;
  const used = sameDay && typeof me.meet_search_count === "number" ? me.meet_search_count : 0;
  if (used >= MEET_DAILY_LIMIT) return { ok: false, code: "rate_limited", message: "今日搜尋次數已用完", status: 429 };

  const key = process.env.minimaxi_api_key ?? "";
  if (key === "") {
    console.error("[search/plan] missing minimaxi_api_key");
    return { ok: false, code: "ai_unavailable", message: "AI 暫時唔可用，請稍後再試", status: 503 };
  }
  onStage("understanding");
  let reply: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MEET_LLM_TIMEOUT_MS);
    try {
      reply = await minimaxChat(
        [
          { role: "system", content: searchPlanPrompt(meetCriteriaSchemaText()).system },
          { role: "user", content: query },
        ],
        { apiKey: key, fetchFn: (url, init) => fetch(url, { ...init, signal: ctrl.signal }), temperature: 0, topP: 1 },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error(`[search/plan] llm error: ${err instanceof Error ? err.message : "unknown"}`);
    return { ok: false, code: "ai_unavailable", message: "AI 暫時唔可用，請稍後再試", status: 503 };
  }
  let parsed;
  try {
    parsed = parsePlanReply(reply);
  } catch {
    console.error("[search/plan] llm reply not json");
    return { ok: false, code: "ai_unavailable", message: "AI 暫時唔可用，請稍後再試", status: 503 };
  }
  const plan = sanitizePlan(parsed.intents);
  const todayStr = new Date(nowMs + 8 * 3600_000).toISOString().slice(0, 10);
  await svc.from("users").update({ meet_search_date: todayStr, meet_search_count: used + 1 }).eq("id", userId);
  return {
    ok: true,
    data: {
      intents: plan.intents,
      ignored: [...parsed.ignored, ...plan.dropped].slice(0, 5),
      remaining_today: Math.max(0, MEET_DAILY_LIMIT - (used + 1)),
    },
  };
}
