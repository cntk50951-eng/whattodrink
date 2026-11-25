import { after } from "next/server";

import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { canDeleteExpiredInvite } from "@/lib/api/invites";
import { retryWrite } from "@/lib/api/retryWrite";
import { classifyTransition, updatedRowCount } from "@/lib/api/transition";
import { sendPartyNoticePush } from "@/lib/push/send";

type ServiceDb = Awaited<ReturnType<typeof createServiceClient>>;

/** 條件更新沒命中任何列時，讀一次現態來分辨「別人先做了同一件事」與「已在別的終態」。 */
async function currentInviteStatus(svc: ServiceDb, id: string): Promise<string | null> {
  const { data } = await svc.from("drink_invites").select("status").eq("id", id).maybeSingle();
  const status = (data as { status?: unknown } | null)?.status;
  return typeof status === "string" ? status : null;
}

const staleTransition = (): Response => apiError("stale_version", "邀約狀態已變更，請重新整理", 409);

/**
 * UR E.16 邀约推进（🔒）。
 * `PATCH /api/v1/invites/:id {action: accept|decline|recall}`：
 * - accept（收方，sent 未过期）：置 accepted＋双向 accepted 落库（service，
 *   明确同意见面，凭事件豁免 D.2 陌生人 403；调用方随后自建会话）＋回 peer。
 * - decline（收方，sent）：置 declined（静默，对方只见未成局）。
 * - recall（发方，sent）：置 recalled。
 * 过期 sent 接受即 410（读时判，无 cron）。
 */
export async function PATCH(
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
  const action = (raw as Record<string, unknown>).action;
  if (action !== "accept" && action !== "decline" && action !== "recall" && action !== "complete") {
    return apiError("invalid_params", "action 只要 accept｜decline｜recall｜complete", 400);
  }
  const { data: rowRaw } = await supabase
    .from("drink_invites")
    .select("id,from_user_id,to_user_id,checkin_id,place,start_at,expires_at,status,created_at")
    .eq("id", id)
    .maybeSingle();
  const row = rowRaw as {
    id: string;
    from_user_id: string;
    to_user_id: string;
    checkin_id: string | null;
    place: string;
    start_at: string | null;
    expires_at: string | null;
    status: string;
    created_at: string;
  } | null;
  if (row === null) return apiError("not_found", "邀約不存在", 404);
  // UR E.16 round-5 完成态（iOS-0.55）：仅发方点；已 completed 重复点幂等 200；
  // 非 accepted 终态 400；已过期点按 410（accepted＋过期＋未 completed 客户端按过期显示）。
  if (action === "complete") {
    if (row.from_user_id !== userId) return apiError("forbidden", "只能完成自己發的", 403);
    if (row.status === "completed") return apiOk({ completed: true });
    if (row.status !== "accepted") {
      return apiError("invalid_params", "邀約不在可完成態", 400);
    }
    if (typeof row.expires_at === "string" && Date.parse(row.expires_at) < Date.now()) {
      return apiError("invalid_params", "邀約已過期", 410);
    }
    const svc = await createServiceClient();
    const { data: doneRows, error } = await supabase
      .from("drink_invites")
      .update({ status: "completed" })
      .eq("id", id)
      .eq("status", "accepted")
      .select("id");
    if (error !== null) {
      console.error(`[api/v1/invites] complete error: code=${error.code} message=${error.message}`);
      return apiError("internal", "完成失敗", 500);
    }
    // 輸掉轉態（對方同時撤銷了）的一方不寫通知、不推播
    const completeOutcome = classifyTransition(updatedRowCount(doneRows), updatedRowCount(doneRows) > 0 ? null : await currentInviteStatus(svc, id), "completed");
    if (completeOutcome === "already") return apiOk({ completed: true });
    if (completeOutcome === "conflict") return staleTransition();
    const { data: actorRow } = await svc.from("users").select("nickname").eq("id", userId).maybeSingle();
    const actorNick =
      typeof (actorRow as { nickname?: unknown } | null)?.nickname === "string" &&
      ((actorRow as { nickname?: string }).nickname ?? "") !== ""
        ? (actorRow as { nickname: string }).nickname
        : "酒友";
    const recipientId = row.to_user_id;
    // 狀態已轉態，通知是對方唯一的提示：瞬時錯誤有界重試，仍失敗留 [needs-repair] 日誌可對賬
    const { error: nErr } = await retryWrite(() => svc.from("notifications").insert({
      user_id: recipientId,
      kind: "invite_completed",
      party_id: null,
      actor_id: userId,
      payload: {
        invite_id: row.id,
        party_place: row.place,
        start_at: row.start_at,
        actor_nickname: actorNick,
      },
    }));
    if (nErr !== null) {
      console.error(`[api/v1/invites] [needs-repair] complete notify invite=${row.id} code=${nErr.code} message=${nErr.message}`);
    }
    after(async () => {
      await sendPartyNoticePush({
        kind: "invite_completed",
        recipientIds: [recipientId],
        actorId: userId,
        actorName: actorNick,
        place: row.place,
        inviteId: row.id,
      });
    });
    return apiOk({ completed: true });
  }
  const expired =
    typeof row.expires_at === "string" && Date.parse(row.expires_at) < Date.now();
  // 撤銷／取消私約：等待中（sent，發起人可撤）或已接受未過期（accepted，雙方均可撤銷）→ 寫站內通知＋推播通知對方
  if (action === "recall") {
    if (row.status === "recalled") return apiOk({ recalled: true });
    if (row.status === "sent") {
      if (row.from_user_id !== userId) return apiError("forbidden", "只能撤回自己發的", 403);
    } else if (row.status === "accepted") {
      if (row.from_user_id !== userId && row.to_user_id !== userId) {
        return apiError("forbidden", "無權撤銷此邀約", 403);
      }
      if (expired) return apiError("invalid_params", "邀約已過期", 410);
    } else {
      return apiError("invalid_params", "邀約已不在可撤銷狀態", 400);
    }
    const svc = await createServiceClient();
    const { data: recalledRows, error } = await svc
      .from("drink_invites")
      .update({ status: "recalled" })
      .eq("id", id)
      .in("status", ["sent", "accepted"])
      .select("id");
    if (error !== null) {
      console.error(`[api/v1/invites] recall error: code=${error.code} message=${error.message}`);
      return apiError("internal", "撤回失敗", 500);
    }
    // 另一個裝置（或對方）已先撤銷／已完成：不重複通知，也不把「已完成」說成撤回成功
    const recallOutcome = classifyTransition(updatedRowCount(recalledRows), updatedRowCount(recalledRows) > 0 ? null : await currentInviteStatus(svc, id), "recalled");
    if (recallOutcome === "already") return apiOk({ recalled: true });
    if (recallOutcome === "conflict") return staleTransition();
    const { data: actorRow } = await svc.from("users").select("nickname").eq("id", userId).maybeSingle();
    const actorNick =
      typeof (actorRow as { nickname?: unknown } | null)?.nickname === "string" &&
      ((actorRow as { nickname?: string }).nickname ?? "") !== ""
        ? (actorRow as { nickname: string }).nickname
        : "酒友";
    const recipientId = userId === row.from_user_id ? row.to_user_id : row.from_user_id;
    const { error: nErr } = await retryWrite(() => svc.from("notifications").insert({
      user_id: recipientId,
      kind: "invite_cancelled",
      party_id: null,
      actor_id: userId,
      payload: {
        invite_id: row.id,
        party_place: row.place,
        start_at: row.start_at,
        actor_nickname: actorNick,
      },
    }));
    if (nErr !== null) {
      console.error(`[api/v1/invites] [needs-repair] recall notify invite=${row.id} code=${nErr.code} message=${nErr.message}`);
    }
    after(async () => {
      await sendPartyNoticePush({
        kind: "invite_cancelled",
        recipientIds: [recipientId],
        actorId: userId,
        actorName: actorNick,
        place: row.place,
        inviteId: row.id,
      });
    });
    return apiOk({ recalled: true });
  }
  if (row.status !== "sent") {
    return apiError("invalid_params", "邀約已不在等待中", 400);
  }
  if (row.to_user_id !== userId) return apiError("forbidden", "只能回應收到的邀約", 403);
  if (expired) return apiError("invalid_params", "邀約已過期", 410);
  if (action === "decline") {
    const { data: declinedRows, error } = await supabase
      .from("drink_invites")
      .update({ status: "declined" })
      .eq("id", id)
      .eq("status", "sent")
      .select("id");
    if (error !== null) {
      console.error(`[api/v1/invites] decline error: code=${error.code} message=${error.message}`);
      return apiError("internal", "操作失敗", 500);
    }
    if (updatedRowCount(declinedRows) === 0) {
      const declineOutcome = classifyTransition(0, await currentInviteStatus(await createServiceClient(), id), "declined");
      return declineOutcome === "already" ? apiOk({ declined: true }) : staleTransition();
    }
    return apiOk({ declined: true });
  }
  // accept：置 accepted＋双向 accepted 落库（service 凭明确同意事件；RLS 只许 pending）。
  const service = await createServiceClient();
  const { data: acceptedRows, error: uErr } = await supabase
    .from("drink_invites")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("status", "sent")
    .select("id");
  if (uErr !== null) {
    console.error(`[api/v1/invites] accept error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "接受失敗", 500);
  }
  // 沒轉到 accepted（對方同時撤回了）就不能寫好友關係，否則兩人會在沒有成局的情況下變好友
  if (updatedRowCount(acceptedRows) === 0) return staleTransition();
  const pair = [
    { user_id: row.from_user_id, friend_id: row.to_user_id, status: "accepted" },
    { user_id: row.to_user_id, friend_id: row.from_user_id, status: "accepted" },
  ];
  const { error: fErr } = await retryWrite(() => service.from("friendships").upsert(pair, {
    onConflict: "user_id,friend_id",
  }));
  if (fErr !== null) {
    // 邀約已是 accepted 但好友行沒寫成：upsert 冪等，對賬時可按此日誌補寫
    console.error(`[api/v1/invites] [needs-repair] befriend invite=${row.id} code=${fErr.code} message=${fErr.message}`);
  }
  const { data: peerRow } = await service
    .from("users")
    .select("id,nickname,avatar_url")
    .eq("id", row.from_user_id)
    .maybeSingle();
  const peer = (peerRow ?? { id: row.from_user_id, nickname: "酒友", avatar_url: null }) as {
    id: string;
    nickname: string;
    avatar_url: string | null;
  };
  return apiOk({
    accepted: true,
    peer: { user_id: peer.id, nickname: peer.nickname, avatar_url: peer.avatar_url },
    place: row.place,
    start_at: row.start_at,
    checkin_id: row.checkin_id,
  });
}

/**
 * 單邊刪除已過期／已結束私約邀請（🔒；0082）。
 * `DELETE /api/v1/invites/:id` —— 僅寫自己一側的 `hidden_by_from_at` / `hidden_by_to_at`，
 * 不物理刪行、不影響對方視角與每日 3 次發起額度；進行中的邀請回 409。
 */
export async function DELETE(
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
  const { data: rowRaw } = await supabase
    .from("drink_invites")
    .select("id,from_user_id,to_user_id,status,expires_at")
    .eq("id", id)
    .maybeSingle();
  const row = rowRaw as {
    id: string;
    from_user_id: string | null;
    to_user_id: string | null;
    status: string;
    expires_at: string | null;
  } | null;
  if (row === null) return apiError("not_found", "邀約不存在", 404);
  const isFrom = row.from_user_id === userId;
  const isTo = row.to_user_id === userId;
  if (!isFrom && !isTo) return apiError("forbidden", "無權操作此邀約", 403);
  const expMs = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : null;
  if (!canDeleteExpiredInvite({ status: row.status, expiresAtMs: expMs, nowMs: Date.now() })) {
    return apiError("not_ended", "進行中的邀約不可刪除，請先撤回或婉拒", 409);
  }
  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (isFrom) patch.hidden_by_from_at = nowIso;
  if (isTo) patch.hidden_by_to_at = nowIso;
  const { error } = await svc.from("drink_invites").update(patch).eq("id", id);
  if (error !== null) {
    if (error.code === "42703") {
      return apiError("internal", "尚未執行約局刪除遷移（0082）", 500);
    }
    console.error(`[api/v1/invites] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "刪除邀約失敗", 500);
  }
  return apiOk({ deleted: true });
}
