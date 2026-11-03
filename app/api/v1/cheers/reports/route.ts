import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  messageEvidence,
  parseReportBody,
  REPORT_DEDUPE_MS,
  REPORT_EVIDENCE_MAX,
  clipSnapshotText,
  type SnapshotLine,
} from "@/lib/userReports";

type MessageRow = { id: string; conversation_id: string; sender_id: string; kind: string; body: string | null; created_at: string | null };
type PostRow = { id: string; user_id: string; place_name: string | null; note: string | null; kind: string | null; created_at: string | null };

/** 訊息證據：被舉報那條＋之前最多 5 條上下文（RLS 保證舉報人只看得到自己會話裡的）。 */
const MESSAGE_CONTEXT = 5;

/**
 * 舉報（🔒；Apple 1.2 要求 UGC 有舉報＋人工審核）。
 * `POST /api/v1/cheers/reports`
 *   用戶：`{target_user_id, reason?, reason_code?}`（舊形狀照舊可用）
 *   帖子：`{target_type:"post", target_id:<checkins.id>, reason?, reason_code?}`
 *   訊息：`{target_type:"message", target_id:<messages.id>, reason?, reason_code?}`
 * 帖子／訊息的作者由服務端按目標反查，並留證據快照；舉報進後台 `/innerharbour/user-reports`。
 * reason 限 200 字；reason_code ∈ harassment|inappropriate|spam|underage|other。
 */
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
  const parsed = parseReportBody(raw, userId);
  if (!parsed.ok) {
    return apiError("invalid_params", parsed.message, 400);
  }
  const p = parsed.value;

  let targetUserId = p.targetUserId;
  let snapshot: SnapshotLine[] | null = null;

  if (p.targetType === "message" && p.targetRef !== null) {
    const { data } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,created_at")
      .eq("id", p.targetRef)
      .maybeSingle();
    const msg = data as MessageRow | null;
    if (msg === null) return apiError("not_found", "找不到這條訊息", 404);
    if (msg.sender_id === userId) return apiError("invalid_params", "不能舉報自己", 400);
    targetUserId = msg.sender_id;
    const { data: ctx } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,created_at")
      .eq("conversation_id", msg.conversation_id)
      .lte("created_at", msg.created_at ?? new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(MESSAGE_CONTEXT + 1);
    const rows = ((ctx ?? []) as MessageRow[]).slice().reverse();
    snapshot = rows.map((m) => messageEvidence(m, msg.sender_id, userId));
  } else if (p.targetType === "post" && p.targetRef !== null) {
    const { data } = await supabase
      .from("checkins")
      .select("id,user_id,place_name,note,kind,created_at")
      .eq("id", p.targetRef)
      .maybeSingle();
    const post = data as PostRow | null;
    if (post === null) return apiError("not_found", "找不到這則帖子", 404);
    if (post.user_id === userId) return apiError("invalid_params", "不能舉報自己", 400);
    targetUserId = post.user_id;
    const text = [post.place_name, post.note].filter((s): s is string => typeof s === "string" && s !== "").join(" · ");
    snapshot = [{ who: "reported", kind: post.kind ?? "post", text: clipSnapshotText(text), at: post.created_at }];
  }

  if (targetUserId === null) {
    return apiError("invalid_params", "target 非法", 400);
  }

  // 用戶舉報附聊天記錄：以服務端原文＋發送時間做快照（不信客戶端文字）。
  // 校驗：消息屬於 conversation_id（RLS 讓舉報人只讀得到自己會話裡的消息）、且是被舉報人發的。
  if (
    p.targetType === "user" &&
    p.evidenceMessageIds !== undefined &&
    p.evidenceMessageIds.length > 0 &&
    p.conversationId !== undefined
  ) {
    const { data: evRows } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,kind,body,created_at")
      .in("id", p.evidenceMessageIds)
      .eq("conversation_id", p.conversationId)
      .eq("sender_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(REPORT_EVIDENCE_MAX);
    const lines = ((evRows ?? []) as MessageRow[]).map((m) => messageEvidence(m, targetUserId, userId));
    if (lines.length > 0) snapshot = lines;
  }

  // 24h 內同一人對同一對象的重複舉報不再入庫（回成功，免洗版；證據以第一次為準）
  const since = new Date(Date.now() - REPORT_DEDUPE_MS).toISOString();
  let dupe = supabase
    .from("cheers_reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("target_type", p.targetType)
    .eq("target_user_id", targetUserId)
    .gte("created_at", since)
    .limit(1);
  dupe = p.targetRef === null ? dupe.is("target_ref", null) : dupe.eq("target_ref", p.targetRef);
  const { data: existing } = await dupe;
  if (Array.isArray(existing) && existing.length > 0) {
    return apiOk({ reported: true });
  }

  const { error } = await supabase.from("cheers_reports").insert({
    reporter_id: userId,
    target_user_id: targetUserId,
    target_type: p.targetType,
    target_ref: p.targetRef,
    reason_code: p.reasonCode,
    reason: p.reason,
    snapshot,
  });
  if (error !== null) {
    console.error(`[api/v1/cheers/reports] insert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "举报失败", 500);
  }
  return apiOk({ reported: true });
}
