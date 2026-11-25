import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { expireJoinRequests } from "@/lib/games/rooms";

/**
 * UR H.2 我的申请（🔒，申请人）。
 * `GET /api/v1/games/join-requests/:rid` —— `{status, room_id?}`（approve 带 room_id；
 * touch 即懒过期）。`DELETE` —— 申请人取消（pending 才删改）。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rid: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(_req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { rid } = await params;
  const svc = await createServiceClient();
  const { data: reqRaw } = await svc
    .from("game_join_requests")
    .select("id,room_id,user_id,status")
    .eq("id", rid)
    .eq("user_id", userId)
    .maybeSingle();
  const joinReq = reqRaw as { id: string; room_id: string; user_id: string; status: string } | null;
  if (joinReq === null) {
    return apiError("not_found", "申請不存在", 404);
  }
  await expireJoinRequests(svc, joinReq.room_id, Date.now());
  const { data: fresh } = await svc
    .from("game_join_requests")
    .select("status")
    .eq("id", rid)
    .maybeSingle();
  const status = (fresh as { status?: unknown } | null)?.status;
  const resolvedStatus = typeof status === "string" ? status : joinReq.status;
  return apiOk({
    status: resolvedStatus,
    ...(resolvedStatus === "approved" ? { room_id: joinReq.room_id } : {}),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ rid: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(_req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { rid } = await params;
  const svc = await createServiceClient();
  const { data: updated, error } = await svc
    .from("game_join_requests")
    .update({ status: "cancelled" })
    .eq("id", rid)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");
  if (error !== null) {
    console.error(`[games/join-requests] cancel error: code=${error.code} message=${error.message}`);
    return apiError("internal", "取消失敗", 500);
  }
  if (Array.isArray(updated) && updated.length > 0) {
    return apiOk({ cancelled: true });
  }
  // 第九輪 §3.1：0 列被取消（可能已先被房主批准／拒絕／過期）→ 讀回真實終態，不假報 cancelled:true
  const { data: curRaw, error: curErr } = await svc
    .from("game_join_requests")
    .select("status,room_id")
    .eq("id", rid)
    .eq("user_id", userId)
    .maybeSingle();
  if (curErr !== null) {
    console.error(`[games/join-requests] cancel read error: code=${curErr.code} message=${curErr.message}`);
    return apiError("internal", "取消失敗", 500);
  }
  const cur = curRaw as { status?: unknown; room_id?: unknown } | null;
  if (cur === null) {
    return apiError("not_found", "申請不存在", 404);
  }
  const curStatus = typeof cur.status === "string" ? cur.status : "cancelled";
  if (curStatus === "cancelled") {
    return apiOk({ cancelled: true });
  }
  return apiOk({
    cancelled: false,
    status: curStatus,
    ...(curStatus === "approved" && typeof cur.room_id === "string" ? { room_id: cur.room_id } : {}),
  });
}
