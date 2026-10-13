import { after } from "next/server";

import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseComplaintText, triageComplaint } from "@/lib/complaints";

/**
 * UR E.31 C2 申辩（🔒，被投訴人）。
 * `POST /api/v1/complaints/:id/respond {text}` —— awaiting_response 且 24h 内；
 * 写后转 pending＋分诊（after）。逾期由读端转 pending（同 GET）。
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
  const parsed = parseComplaintText(raw, "text", 200);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: cRaw } = await svc
    .from("complaints")
    .select("id,target_id,status,response_due_at")
    .eq("id", id)
    .maybeSingle();
  const c = cRaw as { target_id?: unknown; status?: unknown; response_due_at?: unknown } | null;
  if (c === null || c.target_id !== userId) {
    return apiError("not_found", "投訴不存在", 404);
  }
  if (c.status !== "awaiting_response") {
    return apiError("invalid_params", "不在申辯期", 400);
  }
  const due = typeof c.response_due_at === "string" ? Date.parse(c.response_due_at) : NaN;
  if (!Number.isFinite(due) || nowMs > due) {
    await svc.from("complaints").update({ status: "pending" }).eq("id", id);
    after(() => {
      void triageComplaint(svc, id, nowMs);
    });
    return apiError("invalid_params", "申辯已逾期，已轉分診", 400);
  }
  const { error } = await svc
    .from("complaints")
    .update({ response_text: parsed.text, responded_at: new Date(nowMs).toISOString(), status: "pending" })
    .eq("id", id);
  if (error !== null) {
    console.error(`[api/v1/complaints/respond] update error: code=${error.code} message=${error.message}`);
    return apiError("internal", "提交失敗", 500);
  }
  after(() => {
    void triageComplaint(svc, id, nowMs);
  });
  return apiOk({ ok: true });
}
