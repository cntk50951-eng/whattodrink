import { after } from "next/server";

import { appellantRole, isAdverseParty } from "@/lib/complaintAppeal";
import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { triageComplaint } from "@/lib/complaints";
import { publicReasonText } from "@/lib/complaintDecision";

/**
 * UR E.31 C2 单案详情（🔒，仅双方）。
 * `GET /api/v1/complaints/:id` —— 被投訴人看不到投訴人身份（safety 除外）；
 * 不回 ai_json／flags／decided_by（内部审计只给 admin）。
 * touch 顺带：逾期未申辩转 pending＋分诊（after 不拦响应）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: cRaw } = await svc.from("complaints").select("*").eq("id", id).maybeSingle();
  const c = cRaw as Record<string, unknown> | null;
  if (c === null) return apiError("not_found", "投訴不存在", 404);
  const iamFiler = c.filer_id === userId;
  const iamTarget = c.target_id === userId;
  if (!iamFiler && !iamTarget) return apiError("not_found", "投訴不存在", 404);
  // 逾期未申辩：转 pending＋分诊（after）。
  if (
    c.status === "awaiting_response" &&
    typeof c.response_due_at === "string" &&
    Date.parse(c.response_due_at) <= nowMs
  ) {
    // 条件更新（防与后台扫描／并发 touch 竞态）；只有真正转成功的一方触发分诊。
    const { data: moved } = await svc
      .from("complaints")
      .update({ status: "pending" })
      .eq("id", id)
      .eq("status", "awaiting_response")
      .select("id");
    c.status = "pending";
    if (Array.isArray(moved) && moved.length > 0) {
      after(() => {
        void triageComplaint(svc, id, nowMs);
      });
    }
  }
  const showPeer = iamFiler || c.category === "safety";
  const peerId = (iamFiler ? c.target_id : c.filer_id) as string;
  let counterpart: Record<string, unknown> | null = null;
  if (showPeer) {
    const { data: peer } = await svc.from("users").select("id,nickname,avatar_url").eq("id", peerId).maybeSingle();
    const pr = peer as { nickname?: unknown; avatar_url?: unknown } | null;
    counterpart = {
      user_id: peerId,
      nickname: typeof pr?.nickname === "string" && pr.nickname !== "" ? pr.nickname : "酒友",
      avatar_url: typeof pr?.avatar_url === "string" ? pr.avatar_url : null,
    };
  }
  const appellant = appellantRole(c.decision, c.appeal_status);
  const appeal_by_me: boolean | null = appellant === null ? null : appellant === (iamFiler ? "filer" : "target");
  const due = typeof c.response_due_at === "string" ? Date.parse(c.response_due_at) : NaN;
  const decided = typeof c.decided_at === "string" ? Date.parse(c.decided_at) : NaN;
  return apiOk({
    id: c.id,
    party_id: c.party_id,
    category: c.category,
    status: c.status,
    my_role: iamFiler ? "filed" : "against",
    counterpart,
    detail: iamFiler ? c.detail : null,
    evidence: iamFiler ? (Array.isArray(c.evidence) ? c.evidence : []) : [],
    response_text: c.response_text ?? null,
    response_due_at: c.response_due_at ?? null,
    decision: c.decision ?? null,
    // 只回固定枚举文案；管理员内部备注（internal_note）永不外发。
    decision_note: publicReasonText(c.public_reason) || null,
    appeal_status: c.appeal_status ?? null,
    // 時間軸用：只回時間與「是不是我申訴的」；申訴說明只給申訴方自己
    responded_at: c.responded_at ?? null,
    appealed_at: c.appealed_at ?? null,
    appeal_by_me: appeal_by_me,
    appeal_text: appeal_by_me === true && typeof c.appeal_text === "string" ? c.appeal_text : null,
    created_at: c.created_at,
    decided_at: c.decided_at ?? null,
    can_respond:
      iamTarget && c.status === "awaiting_response" && Number.isFinite(due) && nowMs <= due,
    can_appeal:
      isAdverseParty(c.status, iamFiler, iamTarget) &&
      c.appeal_status !== "pending" &&
      Number.isFinite(decided) &&
      nowMs <= decided + TRUST_CONFIG.appeal_window_days * 24 * 3600_000,
  });
}
