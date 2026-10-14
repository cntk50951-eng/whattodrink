import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { moderateCheckin, moderationAction } from "@/lib/moderation";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { after } from "next/server";
import { directKey } from "@/lib/api/chat";
import { buildChatEvidence, parseChatMessageIds } from "@/lib/complaintChat";
import { parseComplaintBody } from "@/lib/complaints";

/**
 * UR E.31 C2 投訴提交（🔒）。
 * `POST /api/v1/parties/:id/complaints {target_user_id, category, detail, evidence?, chat_message_ids?}`
 * （chat_message_ids：我與對方私信裡勾選的消息，≤20；提交時存快照，僅審核員／AI 可見）
 * —— 资格（名单内，退出者以事件记录为准）／局结束（safety 除外）／72h 窗口（safety 除外）／
 * 每局每对一次／每日 5 条／暂停期／late_* 拒／detail 审。201 `{id, status}`。
 * safety 直进人工＋safety_alerts 行；其余 awaiting_response（24h 申辩期）。投訴不必等局結束（no_show 須開局後）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let storageHost = "";
  try {
    storageHost = new URL(envUrl).hostname;
  } catch {
    storageHost = "";
  }
  const parsed = parseComplaintBody(raw, storageHost, userId);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  if (parsed.target_user_id === userId) {
    return apiError("invalid_params", "不可投訴自己", 400);
  }
  // 投訴人门：隐身／未成年／暂停期。
  const { data: meRow } = await supabase
    .from("users")
    .select("mode,dob,complaint_suspended_until")
    .eq("id", userId)
    .maybeSingle();
  const me = ((meRow ?? {}) as Record<string, unknown>);
  if (me.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可投訴", 403);
  }
  if (isMinorDob(me.dob, nowMs)) {
    return apiError("forbidden", "未滿 18 歲不可投訴", 403);
  }
  if (typeof me.complaint_suspended_until === "string" && Date.parse(me.complaint_suspended_until) > nowMs) {
    return apiError("complaint_suspended", `投訴權限暫停至 ${me.complaint_suspended_until}`, 403);
  }
  // 聊天記錄證據（可選）：所選消息必須都在我和對方的 1 對 1 私信裡；快照存庫（私信 90 天過期、對方可能刪）。
  const chatIds = parseChatMessageIds((raw as Record<string, unknown>).chat_message_ids);
  if (!Array.isArray(chatIds)) return apiError("invalid_params", chatIds.error, 400);
  let chatEvidence: unknown[] = [];
  if (chatIds.length > 0) {
    const { data: conv } = await svc
      .from("conversations")
      .select("id")
      .eq("type", "direct")
      .eq("direct_key", directKey(userId, parsed.target_user_id))
      .maybeSingle();
    const convId = (conv as { id?: unknown } | null)?.id;
    if (typeof convId !== "string") return apiError("invalid_params", "你和對方沒有私信記錄，無法附聊天記錄", 400);
    const { data: msgRows } = await svc
      .from("messages")
      .select("id,sender_id,kind,body,attachments,created_at")
      .eq("conversation_id", convId)
      .in("id", chatIds);
    const built = buildChatEvidence(chatIds, (msgRows ?? []) as unknown[], userId, parsed.target_user_id);
    if (!Array.isArray(built)) return apiError("invalid_params", built.error, 400);
    chatEvidence = built;
  }
  // 局与名单（退出者以 party_events join/leave 记录为准）。
  const { data: party } = await svc
    .from("parties")
    .select("id,host_user_id,status,expires_at,start_at")
    .eq("id", id)
    .maybeSingle();
  const p = party as { id?: unknown; host_user_id?: unknown; status?: unknown; expires_at?: unknown; start_at?: unknown } | null;
  if (p === null || typeof p.id !== "string") return apiError("not_found", "酒局不存在", 404);
  const hostId = typeof p.host_user_id === "string" ? p.host_user_id : "";
  const inRoster = async (uid: string): Promise<boolean> => {
    if (uid === hostId) return true;
    const { data: j } = await svc.from("joins").select("user_id").eq("party_id", id).eq("user_id", uid).maybeSingle();
    if (j !== null) return true;
    const { data: ev } = await svc
      .from("party_events")
      .select("id")
      .eq("party_id", id)
      .eq("user_id", uid)
      .in("kind", ["join", "leave", "leave_late", "leave_after_start"])
      .limit(1);
    return Array.isArray(ev) && ev.length > 0;
  };
  if (!(await inRoster(userId)) || !(await inRoster(parsed.target_user_id))) {
    return apiError("not_in_party", "雙方須真實在該局名單", 403);
  }
  const expiresMs = typeof p.expires_at === "string" ? Date.parse(p.expires_at) : NaN;
  const startMs = typeof p.start_at === "string" ? Date.parse(p.start_at) : NaN;
  const isSafety = parsed.category === "safety";
  if (!isSafety) {
    // 產品決定（2026-10-14）：任何時候都能投訴，不必等局結束；只保留結束後 72 小時的上限。
    // 例外：「未到」要開局後才有得判斷。
    if (parsed.category === "no_show" && Number.isFinite(startMs) && nowMs < startMs) {
      return apiError("not_ended", "開局後才可因未到投訴", 409);
    }
    if (Number.isFinite(expiresMs) && nowMs > expiresMs + TRUST_CONFIG.complaint_window_h * 3600_000) {
      return apiError("window_closed", "投訴已截止（結束後 72 小時內）", 409);
    }
    if (p.status === "cancelled" && parsed.category === "no_show") {
      return apiError("invalid_params", "已撤銷的局不可因未到被投", 400);
    }
  }
  // 每日 5 条。
  const dayStart = new Date(new Date(nowMs).setUTCHours(0, 0, 0, 0)).toISOString();
  const { count: dayCount } = await svc
    .from("complaints")
    .select("id", { count: "exact", head: true })
    .eq("filer_id", userId)
    .gte("created_at", dayStart);
  if ((dayCount ?? 0) >= TRUST_CONFIG.complaint_daily_cap) {
    return apiError("rate_limited", "今日投訴已達上限（5 條）", 429);
  }
  // 说明过审（敏感词管线，沿 host_intro）。
  const verdict = await moderateCheckin(
    { text: parsed.detail },
    {
      openaiKey: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
      minimaxKey: process.env.minimaxi_api_key,
      minimaxBaseUrl: process.env.MINIMAX_API_BASE,
    },
  );
  const action = moderationAction(verdict);
  if (action === "reject") {
    return apiError("rejected", "內容未通過審核（說明），請修改後再發", 403);
  }
  if (action === "unavailable") {
    return apiError("rejected", "審核服務暫不可用，請稍後再試", 503);
  }
  const status = isSafety ? "escalated" : "awaiting_response";  const { data: inserted, error: iErr } = await svc
    .from("complaints")
    .insert({
      party_id: id,
      filer_id: userId,
      target_id: parsed.target_user_id,
      category: parsed.category,
      detail: parsed.detail,
      evidence: parsed.evidence,
      chat_evidence: chatEvidence,
      status,
      response_due_at: isSafety ? null : new Date(nowMs + TRUST_CONFIG.response_window_h * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (iErr !== null || inserted === null) {
    if (iErr?.code === "23505") {
      return apiError("duplicate", "該局對該對象已投訴過", 409);
    }
    console.error(`[api/v1/parties/complaints] insert error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "投訴提交失敗", 500);
  }
  const cid = (inserted as { id: string }).id;
  // 规则层 flags：报复（48h 内对方投过我→两条标）／重复对（我投对方 90 天 ≥3）。
  const since48 = new Date(nowMs - TRUST_CONFIG.retaliation_window_h * 3600_000).toISOString();
  const { data: reverse } = await svc
    .from("complaints")
    .select("id")
    .eq("filer_id", parsed.target_user_id)
    .eq("target_id", userId)
    .gte("created_at", since48)
    .limit(5);
  const flags: string[] = [];
  if (Array.isArray(reverse) && reverse.length > 0) {
    flags.push("retaliation");
    const rIds = (reverse as { id?: unknown }[]).map((r) => r.id).filter((v): v is string => typeof v === "string");
    if (rIds.length > 0) {
      const { data: rRows } = await svc.from("complaints").select("id,flags").in("id", rIds);
      for (const rr of ((rRows ?? []) as unknown[]) as { id?: unknown; flags?: unknown }[]) {
        if (typeof rr.id !== "string") continue;
        const f = Array.isArray(rr.flags) ? (rr.flags as unknown[]).filter((x): x is string => typeof x === "string") : [];
        if (!f.includes("retaliation")) {
          await svc.from("complaints").update({ flags: [...f, "retaliation"] }).eq("id", rr.id);
        }
      }
    }
  }
  const since90 = new Date(nowMs - 90 * 24 * 3600_000).toISOString();
  const { count: pairCount } = await svc
    .from("complaints")
    .select("id", { count: "exact", head: true })
    .eq("filer_id", userId)
    .eq("target_id", parsed.target_user_id)
    .gte("created_at", since90);
  if ((pairCount ?? 0) >= TRUST_CONFIG.repeat_pair_flag_count) flags.push("repeat_pair");
  if (flags.length > 0) {
    await svc.from("complaints").update({ flags }).eq("id", cid);
  }
  // no_show 矛盾预判（对方有打卡→对本案不利，记 flag 不拦流程）。
  if (parsed.category === "no_show") {
    const { data: att } = await svc
      .from("party_attendance")
      .select("arrived_at")
      .eq("party_id", id)
      .eq("user_id", parsed.target_user_id)
      .maybeSingle();
    if (typeof (att as { arrived_at?: unknown } | null)?.arrived_at === "string") {
      const { data: cur } = await svc.from("complaints").select("flags").eq("id", cid).maybeSingle();
      const cf = Array.isArray((cur as { flags?: unknown } | null)?.flags)
        ? ((cur as { flags: unknown[] }).flags.filter((x): x is string => typeof x === "string"))
        : [];
      if (!cf.includes("contradicted_by_checkin")) {
        await svc.from("complaints").update({ flags: [...cf, "contradicted_by_checkin"] }).eq("id", cid);
      }
    }
  }
  // 通知被投訴人（actor 隐去，safety 除外）。
  await svc.from("notifications").insert({
    user_id: parsed.target_user_id,
    kind: "complaint_filed",
    party_id: id,
    actor_id: isSafety ? userId : null,
    payload: {
      complaint_id: cid,
      category: parsed.category,
      ...(isSafety ? {} : { response_due_at: new Date(nowMs + TRUST_CONFIG.response_window_h * 3600_000).toISOString() }),
    },
  });
  if (isSafety) {
    await svc.from("safety_alerts").insert({ complaint_id: cid, party_id: id });
    // 安全類直進人工；AI 只在後台給審核員一份分析（不判定、不動狀態）
    after(async () => {
      const { adviseComplaint } = await import("@/lib/complaintTriage");
      await adviseComplaint(svc, cid);
    });
  }
  return apiOk({ id: cid, status }, 201);
}
