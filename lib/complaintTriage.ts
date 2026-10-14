/**
 * 投訴 AI 分診（IO 層）：組材料（事件時間線／到場／聊天快照／圖片）→ 視覺模型 → 閾值路由 → 自動判或轉人工。
 * 純邏輯（提示詞／解析／路由）在 complaintAi.ts；這裡只做查庫、取圖、調模型、落庫。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseStoredChatEvidence } from "./complaintChat";
import {
  AI_THRESHOLDS,
  ROUTE_REASON_TEXT,
  aiAutoEnabled,
  buildTriageContent,
  maskForAi,
  parseTriageV2,
  relMin,
  routeTriage,
  triageSystemPrompt,
  type AiChatLine,
  type AiFacts,
  type AiImageRef,
  type AiSuggestionV2,
  type AiTimelineEntry,
} from "./complaintAi";
import { evidenceStoragePath } from "./complaints";
import { MINIMAX_CHAT_PATH, MINIMAX_DEFAULT_BASE } from "./moderation";

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MODEL = "MiniMax-M3";

type Row = Record<string, unknown>;

function mimeOf(path: string, blobType: string): string {
  if (blobType.startsWith("image/")) return blobType;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
}

async function fetchImageDataUrl(svc: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await svc.storage.from("chat-images").download(path);
    if (error !== null || data === null || data.size === 0 || data.size > MAX_IMAGE_BYTES) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return `data:${mimeOf(path, data.type)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 查庫組材料；取不到的圖記 incomplete（路由會因此轉人工）。 */
export async function buildAiInputs(
  svc: SupabaseClient,
  c: Row,
): Promise<{ facts: AiFacts; imageUrls: string[]; incomplete: boolean; leaning: "uphold" | "dismiss" | null }> {
  const partyId = c.party_id as string;
  const filerId = c.filer_id as string;
  const targetId = c.target_id as string;
  const flags = Array.isArray(c.flags) ? (c.flags as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const nowMs = Date.now();
  const [{ data: party }, { data: atts }, { data: events }, { count: pairCount }] = await Promise.all([
    svc.from("parties").select("host_user_id,start_at,expires_at").eq("id", partyId).maybeSingle(),
    svc.from("party_attendance").select("user_id,arrived_at,host_marked").eq("party_id", partyId).limit(500),
    svc.from("party_events").select("user_id,kind,created_at").eq("party_id", partyId).order("created_at", { ascending: true }).limit(200),
    svc.from("complaints").select("id", { count: "exact", head: true })
      .or(`and(filer_id.eq.${filerId},target_id.eq.${targetId}),and(filer_id.eq.${targetId},target_id.eq.${filerId})`)
      .gte("created_at", new Date(nowMs - 90 * 24 * 3600_000).toISOString()),
  ]);
  const p = (party ?? {}) as Row;
  const hostId = typeof p.host_user_id === "string" ? p.host_user_id : "";
  const startMs = typeof p.start_at === "string" ? Date.parse(p.start_at) : NaN;
  const endMs = typeof p.expires_at === "string" ? Date.parse(p.expires_at) : NaN;
  const whoOf = (uid: unknown): AiTimelineEntry["who"] =>
    uid === filerId ? "A" : uid === targetId ? "B" : uid === hostId ? "host" : "other";

  const timeline: AiTimelineEntry[] = [];
  for (const e of ((events ?? []) as unknown[]) as Row[]) {
    const who = whoOf(e.user_id);
    const t = relMin(e.created_at, startMs);
    if (who === "other" || t === null || typeof e.kind !== "string") continue;
    timeline.push({ t_min: t, who, what: e.kind });
  }
  const attRows = ((atts ?? []) as unknown[]) as Row[];
  const attOf = (uid: string) => {
    const hit = attRows.find((a) => a.user_id === uid);
    return {
      arrived: typeof hit?.arrived_at === "string",
      arrived_at_min: relMin(hit?.arrived_at, startMs),
      host_mark: (hit?.host_marked === true ? "present" : hit?.host_marked === false ? "absent" : "none") as "present" | "absent" | "none",
    };
  };
  const A = attOf(filerId);
  const B = attOf(targetId);
  for (const [who, a] of [["A", A], ["B", B]] as const) {
    if (a.arrived && a.arrived_at_min !== null) timeline.push({ t_min: a.arrived_at_min, who, what: "arrived_checkin" });
  }
  timeline.sort((x, y) => x.t_min - y.t_min);

  // 圖片：投訴證據截圖＋聊天快照裡的圖
  const images: AiImageRef[] = [];
  const imageUrls: string[] = [];
  let incomplete = false;
  const addImage = async (path: string, source: AiImageRef["source"], from: "A" | "B"): Promise<number | null> => {
    if (imageUrls.length >= MAX_IMAGES) {
      incomplete = true;
      return null;
    }
    const url = await fetchImageDataUrl(svc, path);
    if (url === null) {
      incomplete = true;
      return null;
    }
    imageUrls.push(url);
    const index = imageUrls.length;
    images.push({ index, source, from });
    return index;
  };
  for (const e of Array.isArray(c.evidence) ? (c.evidence as unknown[]) : []) {
    const path = typeof e === "string" ? evidenceStoragePath(e) : null;
    if (path === null) {
      incomplete = true;
      continue;
    }
    await addImage(path, "evidence", "A");
  }
  const chat: AiChatLine[] = [];
  let n = 0;
  for (const m of parseStoredChatEvidence(c.chat_evidence)) {
    n += 1;
    const from = m.sender === "filer" ? "A" : "B";
    const at_min = relMin(m.at, startMs) ?? 0;
    if (m.kind === "image" && m.image_path !== null) {
      const idx = await addImage(m.image_path, "chat", from);
      chat.push({ n, from, at_min, text: null, image_index: idx });
    } else {
      chat.push({ n, from, at_min, text: maskForAi(m.body ?? ""), image_index: null });
    }
  }

  // 規則傾向（確定性；沿舊邏輯）
  const category = String(c.category ?? "");
  let leaning: "uphold" | "dismiss" | null = null;
  if (category === "no_show" && B.arrived) leaning = "dismiss";
  else if (category === "no_show" && B.host_mark === "absent" && !B.arrived && (c.response_text === null || c.response_text === undefined)) leaning = "uphold";

  const facts: AiFacts = {
    category,
    roles: { A: filerId === hostId ? "host" : "member", B: targetId === hostId ? "host" : "member" },
    complaint_text: maskForAi(typeof c.detail === "string" ? c.detail : ""),
    response_text: typeof c.response_text === "string" ? maskForAi(c.response_text) : null,
    party: { start_unix_min_ref: 0, duration_min: Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.round((endMs - startMs) / 60000) : null },
    timeline,
    attendance: { A, B },
    chat_evidence: chat,
    chat_evidence_note: chat.length === 0
      ? "投訴人沒有附聊天記錄（可能兩人之間沒有私信）。不要把「沒有聊天記錄」當作對任何一方不利的證據。"
      : "以上是投訴人自己挑選附上的私信，可能缺上下文。",
    images,
    flags: {
      retaliation: flags.includes("retaliation"),
      repeat_pair: flags.includes("repeat_pair"),
      contradicted_by_checkin: flags.includes("contradicted_by_checkin"),
    },
    complaints_between_pair_90d: pairCount ?? 0,
  };
  return { facts, imageUrls, incomplete, leaning };
}

/** 調視覺模型（temperature 0；帶圖放寬到 45s；解析失敗重試 1 次）。 */
export async function callTriageModel(
  facts: AiFacts,
  imageUrls: string[],
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ suggestion: AiSuggestionV2; ms: number } | null> {
  const base = (process.env.MINIMAX_API_BASE ?? MINIMAX_DEFAULT_BASE).replace(/\/$/, "");
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), imageUrls.length > 0 ? 45_000 : 20_000);
    try {
      const res = await fetchFn(`${base}${MINIMAX_CHAT_PATH}`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          thinking: { type: "disabled" },
          temperature: 0,
          max_completion_tokens: 1200,
          messages: [
            { role: "system", content: triageSystemPrompt() },
            { role: "user", content: buildTriageContent(facts, imageUrls) },
          ],
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = json.choices?.[0]?.message?.content;
      const suggestion = typeof content === "string" ? parseTriageV2(content) : null;
      if (suggestion !== null) return { suggestion, ms: Date.now() - started };
    } catch {
      // 超時／網絡：重試一次
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function aiRecord(
  r: { suggestion: AiSuggestionV2; ms: number } | null,
  route: ReturnType<typeof routeTriage>,
  inputs: { chat_n: number; images_n: number; incomplete: boolean },
) {
  return {
    ...(r === null ? {} : { suggestion: r.suggestion, model: MODEL, ms: r.ms }),
    route: { action: route.action, reason: route.reason, text: ROUTE_REASON_TEXT[route.reason] ?? route.reason },
    inputs,
    thresholds: AI_THRESHOLDS,
    version: 2,
  };
}

/**
 * 分診（pending 案；申辯後／逾期觸發）：AI 分析 → 閾值路由。
 * 自動成立／駁回走 decideComplaint（by "ai"，對外理由只用枚舉）；其餘轉人工。申訴案永遠人工（可再申訴一次）。
 */
export async function runTriage(
  svc: SupabaseClient,
  complaintId: string,
  nowMs: number = Date.now(),
): Promise<{ routed: boolean; status: string }> {
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", complaintId).maybeSingle();
  const c = cRaw as Row | null;
  if (c === null || c.status !== "pending") return { routed: false, status: typeof c?.status === "string" ? c.status : "" };
  const flags = Array.isArray(c.flags) ? (c.flags as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const { facts, imageUrls, incomplete, leaning } = await buildAiInputs(svc, c);
  const apiKey = process.env.minimaxi_api_key ?? "";
  const r = apiKey === "" ? null : await callTriageModel(facts, imageUrls, apiKey);
  const route = routeTriage(r?.suggestion ?? null, {
    category: String(c.category ?? ""),
    flags,
    leaning,
    inputsIncomplete: incomplete,
    autoEnabled: aiAutoEnabled(),
  });
  const inputs = { chat_n: facts.chat_evidence.length, images_n: imageUrls.length, incomplete };
  await svc.from("complaints").update({
    ai_json: aiRecord(r, route, inputs),
    ...(r === null ? { ai_error: apiKey === "" ? "no-key" : "ai-failed" } : {}),
  }).eq("id", complaintId);
  if (route.action === "human" || r === null) {
    await svc.from("complaints").update({ status: "escalated" }).eq("id", complaintId).eq("status", "pending");
    return { routed: true, status: "escalated" };
  }
  const { data: moved } = await svc
    .from("complaints")
    .update({ status: "escalated" })
    .eq("id", complaintId)
    .eq("status", "pending")
    .select("id");
  if (!Array.isArray(moved) || moved.length === 0) return { routed: false, status: "" };
  const { decideComplaint } = await import("./complaintDecision");
  const publicReason = route.action === "uphold" ? "evidence_confirmed" : leaning === "dismiss" ? "contradicted_by_records" : "insufficient_evidence";
  const res = await decideComplaint(
    svc,
    complaintId,
    route.action,
    {
      severity: r.suggestion.severity,
      internalNote: `AI 自動判定（p_uphold=${r.suggestion.p_uphold}，信心 ${r.suggestion.confidence}）：${r.suggestion.rationale}`,
      publicReason,
      by: "ai",
    },
    nowMs,
  );
  if (!res.ok) {
    // 判定失敗：留在人工隊列，不丟案件
    return { routed: true, status: "escalated" };
  }
  return { routed: true, status: route.action === "dismiss" ? "dismissed" : "upheld" };
}

/**
 * 僅建議（人身安全類等直進人工的案件）：跑 AI 把分析寫進 ai_json 給審核員參考，不動狀態、不判定。
 */
export async function adviseComplaint(svc: SupabaseClient, complaintId: string): Promise<void> {
  const apiKey = process.env.minimaxi_api_key ?? "";
  if (apiKey === "") return;
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", complaintId).maybeSingle();
  const c = cRaw as Row | null;
  if (c === null || c.ai_json !== null && c.ai_json !== undefined) return;
  const { facts, imageUrls, incomplete } = await buildAiInputs(svc, c);
  const r = await callTriageModel(facts, imageUrls, apiKey);
  const route = routeTriage(r?.suggestion ?? null, {
    category: String(c.category ?? ""), flags: [], leaning: null, inputsIncomplete: incomplete, autoEnabled: false,
  });
  const inputs = { chat_n: facts.chat_evidence.length, images_n: imageUrls.length, incomplete };
  await svc.from("complaints").update({
    ai_json: aiRecord(r, { action: "human", reason: String(c.category) === "safety" ? "safety" : route.reason }, inputs),
    ...(r === null ? { ai_error: "ai-failed" } : {}),
  }).eq("id", complaintId);
}
