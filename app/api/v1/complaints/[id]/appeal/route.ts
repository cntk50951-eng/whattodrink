import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { parseComplaintText } from "@/lib/complaints";

/**
 * UR E.31 C2 申诉（🔒，双方任一方对自己不利的结果）。
 * `POST /api/v1/complaints/:id/appeal {text}` —— decided 后 7 天内一次；
 * `appeal_status='pending'`＋状态回 escalated＋标 appeal，一律人工。
 * 改判反向沖銷由 admin 执行 applyDecision（C2 后台口）。
 */
export async function POST(
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
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseComplaintText(raw, "text", 500);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: cRaw } = await svc
    .from("complaints")
    .select("id,filer_id,target_id,status,decided_at,appeal_status")
    .eq("id", id)
    .maybeSingle();
  const c = cRaw as {
    filer_id?: unknown;
    target_id?: unknown;
    status?: unknown;
    decided_at?: unknown;
    appeal_status?: unknown;
  } | null;
  if (c === null || (c.filer_id !== userId && c.target_id !== userId)) {
    return apiError("not_found", "投訴不存在", 404);
  }
  if (c.status !== "upheld" && c.status !== "dismissed" && c.status !== "malicious") {
    return apiError("invalid_params", "未有结果不可申诉", 400);
  }
  if (c.appeal_status === "pending") {
    return apiError("invalid_params", "已申诉过一次", 400);
  }
  const decided = typeof c.decided_at === "string" ? Date.parse(c.decided_at) : NaN;
  if (!Number.isFinite(decided) || nowMs > decided + TRUST_CONFIG.appeal_window_days * 24 * 3600_000) {
    return apiError("invalid_params", "申诉已截止（结果后 7 天内）", 400);
  }
  // 对自己不利才可申诉：被投 upheld／malicious 的是 target；dismissed 的是 filer。
  const adverse =
    (c.status === "upheld" || c.status === "malicious") ? c.target_id === userId : c.filer_id === userId;
  if (!adverse) {
    return apiError("invalid_params", "该结果对你有利，无需申诉", 400);
  }
  const { data: cur } = await svc.from("complaints").select("flags").eq("id", id).maybeSingle();
  const flags = Array.isArray((cur as { flags?: unknown } | null)?.flags)
    ? ((cur as { flags: unknown[] }).flags.filter((x): x is string => typeof x === "string"))
    : [];
  const { error } = await svc
    .from("complaints")
    .update({
      appeal_text: parsed.text,
      appeal_status: "pending",
      appealed_at: new Date(nowMs).toISOString(),
      status: "escalated",
      flags: flags.includes("appeal") ? flags : [...flags, "appeal"],
    })
    .eq("id", id);
  if (error !== null) {
    console.error(`[api/v1/complaints/appeal] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "提交失敗", 500);
  }
  return apiOk({ ok: true });
}
