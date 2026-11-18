import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import {
  appendEvent,
  bumpRoom,
  getActiveMembers,
  loadRoomAsMember,
  parseJoinDecision,
  requireHost,
} from "@/lib/games/rooms";

/**
 * UR H.2 入房审批（🔒，仅房主）。
 * `POST /api/v1/games/rooms/:id/requests/:rid {decision}` —— approve：房 lobby
 * 且有空位即插 player（seat 顺延）＋version+1，满员 409／已开局 409；
 * reject：标记＋通知。幂等（已处理重调回同结果）。
 * 双方通知 game_join_result（approve 带 room_id）。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parseJoinDecision(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { id, rid } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  const { data: reqRaw } = await svc
    .from("game_join_requests")
    .select("id,room_id,user_id,status")
    .eq("id", rid)
    .eq("room_id", loaded.room.id)
    .maybeSingle();
  const joinReq = reqRaw as { id: string; room_id: string; user_id: string; status: string } | null;
  if (joinReq === null) {
    return apiError("not_found", "申請不存在", 404);
  }
  if (joinReq.status === "approved") {
    return apiOk({ version: loaded.room.version, status: "approved" as const });
  }
  if (joinReq.status !== "pending") {
    return apiOk({ version: loaded.room.version, status: joinReq.status });
  }
  const nowIso = new Date().toISOString();
  if (parsed.decision === "reject") {
    await svc
      .from("game_join_requests")
      .update({ status: "rejected", decided_at: nowIso, decided_by: userId })
      .eq("id", rid);
    await svc.from("notifications").insert({
      user_id: joinReq.user_id,
      kind: "game_join_result",
      actor_id: userId,
      payload: { decision: "rejected", room_id: loaded.room.id },
    });
    return apiOk({ version: loaded.room.version, status: "rejected" as const });
  }
  // approve：房 lobby＋有空位（并发撞满即 409，沿 join 口径）。
  if (loaded.room.status !== "lobby") {
    return apiError("room_started", "對局已開始，不可再加入", 409);
  }
  // A pending application can coexist with a player inserted by an earlier attempt.
  // Check before capacity: an existing active player does not consume another seat.
  const { data: existing, error: existingErr } = await svc.from("game_room_players")
    .select("user_id,status").eq("room_id", loaded.room.id).eq("user_id", joinReq.user_id).maybeSingle();
  if (existingErr) return apiError("internal", "讀取成員失敗", 500);
  if (existing && existing.status !== "active") return apiError("forbidden", "該玩家不可重新加入", 403);
  let inserted = false;
  let seat = 0;
  if (!existing) {
    const members = await getActiveMembers(svc, loaded.room.id);
    if (members.length >= loaded.room.max_players) return apiError("room_full", "房間已滿", 409);
    seat = members.reduce((mx, m) => Math.max(mx, m.seat), -1) + 1;
    const { error: jErr } = await svc.from("game_room_players").insert({
      room_id: loaded.room.id, user_id: joinReq.user_id, seat, ready: false, status: "active",
    });
    if (jErr) {
      if (jErr.code !== "23505") return apiError("internal", "同意失敗", 500);
      // A unique seat collision with a DIFFERENT player must not approve this request.
      const { data: raced, error: racedErr } = await svc.from("game_room_players")
        .select("status").eq("room_id", loaded.room.id).eq("user_id", joinReq.user_id).maybeSingle();
      if (racedErr) return apiError("internal", "讀取成員失敗", 500);
      if (raced?.status !== "active") return apiError("room_full", "席位已變更，請重試", 409);
    } else inserted = true;
  }
  const { data: decided, error: decisionErr } = await svc
    .from("game_join_requests")
    .update({ status: "approved", decided_at: nowIso, decided_by: userId })
    .eq("id", rid).eq("status", "pending").select("id");
  if (decisionErr) return apiError("internal", "同意失敗", 500);
  if (!decided?.length) {
    const { data: current } = await svc.from("game_join_requests").select("status").eq("id", rid).maybeSingle();
    if (!current) return apiError("internal", "讀取申請失敗", 500);
    return apiOk({ version: loaded.room.version, status: current.status });
  }
  const version = inserted ? await bumpRoom(svc, loaded.room.id, loaded.room.version, Date.now()) : null;
  if (version !== null) {
    await appendEvent(svc, loaded.room.id, version, "member_joined", joinReq.user_id, { seat, via: "request" });
  }
  await svc.from("notifications").insert({
    user_id: joinReq.user_id,
    kind: "game_join_result",
    actor_id: userId,
    payload: { decision: "approved", room_id: loaded.room.id },
  });
  return apiOk({ version: version ?? loaded.room.version, status: "approved" as const });
}
