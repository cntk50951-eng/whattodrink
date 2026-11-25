import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { retryWrite } from "@/lib/api/retryWrite";
import {
  appendEvent,
  approveJoinRequestAtomic,
  bumpRoom,
  claimRoomSeat,
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
  // 第九輪 §3.1：approve 優先走 0086 單一交易 RPC（同時鎖房間與申請、寫席位、遞增版本與標記 approved），
  // 杜絕「先 approved 後佔位」的中間態 404 與回滾失敗卡死；0086 未套用時回傳 null 退回既有流程。
  if (parsed.decision === "approve" && typeof approveJoinRequestAtomic === "function") {
    const atomic = await approveJoinRequestAtomic(svc, loaded.room.id, rid, userId);
    if (atomic !== null) {
      if (atomic.kind === "not_found") return apiError("not_found", "申請不存在", 404);
      if (atomic.kind === "not_host") return apiError("not_host", "只有房主可以審批", 403);
      if (atomic.kind === "room_not_found") return apiError("room_not_found", "房間不存在或已結束", 404);
      if (atomic.kind === "room_full") return apiError("room_full", "房間已滿", 409);
      if (atomic.kind === "room_started") return apiError("room_started", "對局已開始，不可再加入", 409);
      if (atomic.kind === "kicked") return apiError("forbidden", "該玩家不可重新加入", 403);
      if (atomic.kind === "already_approved") {
        return apiOk({ version: atomic.version || loaded.room.version, status: "approved" as const });
      }
      if (atomic.kind === "not_pending") {
        return apiOk({ version: atomic.version || loaded.room.version, status: atomic.status });
      }
      if (atomic.kind !== "ok") {
        return apiError("internal", "同意失敗", 500);
      }
      if (atomic.inserted) {
        await appendEvent(svc, loaded.room.id, atomic.version, "member_joined", atomic.applicantId, { seat: atomic.seat, via: "request" });
      }
      if (atomic.applicantId) {
        const { error: nErr } = await retryWrite(() => svc.from("notifications").insert({
          user_id: atomic.applicantId,
          kind: "game_join_result",
          actor_id: userId,
          payload: { decision: "approved", room_id: loaded.room.id },
        }));
        if (nErr) console.error(`[games/requests] [needs-repair] approve notify request=${rid} code=${nErr.code}`);
      }
      return apiOk({ version: atomic.version || loaded.room.version, status: "approved" as const });
    }
  }
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
    // 補洞（第九輪 §3.1）：舊路徑若上次批准後佔位與回滾皆失敗，重按 approve 時檢查是否真的已入座；已入座才冪等早退
    if (parsed.decision === "approve") {
      const { data: existingSeat } = await svc.from("game_room_players")
        .select("user_id,status").eq("room_id", loaded.room.id).eq("user_id", joinReq.user_id).maybeSingle();
      if (existingSeat && existingSeat.status === "active") {
        return apiOk({ version: loaded.room.version, status: "approved" as const });
      }
      if (existingSeat && existingSeat.status !== "active") {
        return apiError("forbidden", "該玩家不可重新加入", 403);
      }
      const repair = await claimRoomSeat(svc, loaded.room.id, joinReq.user_id, Date.now());
      if (repair.kind !== "ok" && repair.kind !== "already") {
        if (repair.kind === "room_full") return apiError("room_full", "房間已滿", 409);
        if (repair.kind === "room_started") return apiError("room_started", "對局已開始，不可再加入", 409);
        if (repair.kind === "kicked") return apiError("forbidden", "該玩家不可重新加入", 403);
        if (repair.kind === "room_not_found") return apiError("room_not_found", "房間不存在或已結束", 404);
        return apiError("internal", "同意失敗", 500);
      }
      const ver = repair.kind === "ok" ? await bumpRoom(svc, loaded.room.id, loaded.room.version, Date.now()) : null;
      if (ver !== null) {
        await appendEvent(svc, loaded.room.id, ver, "member_joined", joinReq.user_id, { seat: repair.seat, via: "request" });
      }
      return apiOk({ version: ver ?? loaded.room.version, status: "approved" as const });
    }
    return apiOk({ version: loaded.room.version, status: "approved" as const });
  }
  if (joinReq.status !== "pending") {
    return apiOk({ version: loaded.room.version, status: joinReq.status });
  }
  const nowIso = new Date().toISOString();
  if (parsed.decision === "reject") {
    // 第八輪 R8-02：與取消／另一裝置的決定互斥——只轉 pending 的那一行，錯誤要讀；輸掉的一方不發通知
    const { data: rejected, error: rejErr } = await svc
      .from("game_join_requests")
      .update({ status: "rejected", decided_at: nowIso, decided_by: userId })
      .eq("id", rid).eq("status", "pending").select("id");
    if (rejErr) return apiError("internal", "拒絕失敗", 500);
    if (!rejected?.length) {
      const { data: current } = await svc.from("game_join_requests").select("status").eq("id", rid).maybeSingle();
      if (!current) return apiError("internal", "讀取申請失敗", 500);
      return apiOk({ version: loaded.room.version, status: current.status });
    }
    const { error: nErr } = await retryWrite(() => svc.from("notifications").insert({
      user_id: joinReq.user_id,
      kind: "game_join_result",
      actor_id: userId,
      payload: { decision: "rejected", room_id: loaded.room.id },
    }));
    if (nErr) console.error(`[games/requests] [needs-repair] reject notify request=${rid} code=${nErr.code}`);
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
  // 第八輪 R8-02：先對申請做 compare-and-set（pending→approved），再佔位。
  // 以前先佔位後 CAS：玩家在兩者之間取消、或另一裝置先拒絕，申請是 cancelled／rejected，成員卻已 active。
  // 現在 CAS 是申請列上的原子操作：取消（也只轉 pending）與批准互斥，輸的一方拿不到席位。
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
  let inserted = false;
  let seat = 0;
  if (!existing) {
    // 原子佔位（第七輪 §3.4）：與 join／bump-join 同一個 RPC，鎖房間行後數人與算席號，並發同意不會超員或同席
    const claim = await claimRoomSeat(svc, loaded.room.id, joinReq.user_id, Date.now());
    if (claim.kind !== "ok" && claim.kind !== "already") {
      // 沒佔到位：把申請退回 pending（只退我們剛轉的 approved），房主可稍後重試；退回失敗留 [needs-repair]
      const { data: undone, error: undoErr } = await svc
        .from("game_join_requests")
        .update({ status: "pending", decided_at: null, decided_by: null })
        .eq("id", rid).eq("status", "approved").eq("decided_by", userId).select("id");
      if (undoErr || !undone?.length) console.error(`[games/requests] [needs-repair] approve rollback request=${rid} claim=${claim.kind}`);
      if (claim.kind === "room_full") return apiError("room_full", "房間已滿", 409);
      if (claim.kind === "room_started") return apiError("room_started", "對局已開始，不可再加入", 409);
      if (claim.kind === "kicked") return apiError("forbidden", "該玩家不可重新加入", 403);
      if (claim.kind === "room_not_found") return apiError("room_not_found", "房間不存在或已結束", 404);
      return apiError("internal", "同意失敗", 500);
    }
    seat = claim.seat;
    inserted = claim.kind === "ok";
  }
  const version = inserted ? await bumpRoom(svc, loaded.room.id, loaded.room.version, Date.now()) : null;
  if (version !== null) {
    await appendEvent(svc, loaded.room.id, version, "member_joined", joinReq.user_id, { seat, via: "request" });
  }
  const { error: nErr } = await retryWrite(() => svc.from("notifications").insert({
    user_id: joinReq.user_id,
    kind: "game_join_result",
    actor_id: userId,
    payload: { decision: "approved", room_id: loaded.room.id },
  }));
  if (nErr) console.error(`[games/requests] [needs-repair] approve notify request=${rid} code=${nErr.code}`);
  return apiOk({ version: version ?? loaded.room.version, status: "approved" as const });
}
