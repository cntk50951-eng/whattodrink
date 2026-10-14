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
  return apiOk({
    status: typeof status === "string" ? status : joinReq.status,
    ...(joinReq.status === "approved" ? { room_id: joinReq.room_id } : {}),
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
  const { error } = await svc
    .from("game_join_requests")
    .update({ status: "cancelled" })
    .eq("id", rid)
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error !== null) {
    console.error(`[games/join-requests] cancel error: code=${error.code} message=${error.message}`);
    return apiError("internal", "取消失敗", 500);
  }
  return apiOk({ cancelled: true });
}
