import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCheckinIdParam } from "@/lib/api/checkins";
import { parseRequestAction } from "@/lib/friends";
import { sendFriendPush } from "@/lib/push/send";

/**
 * UR B.3 请求动作（🔒）。
 * `PATCH /api/v1/friends/requests/{id} {action}` —— accept 仅收件人（双向 accepted，
 * 缺反向行即补；已 accepted 幂等 200）／decline 删入行＋清反向 pending／cancel 删己方行；
 * 非 pending（不存在／已处理）404；越权 404（不泄存在性）；拉黑任一方 404。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsedId = parseCheckinIdParam(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const actionParsed = parseRequestAction((raw as Record<string, unknown>).action);
  if ("error" in actionParsed) {
    return apiError("invalid_params", actionParsed.error, 400);
  }
  const action = actionParsed.action;
  const svc = await createServiceClient();
  const { data: rowRaw } = await svc
    .from("friendships")
    .select("id,user_id,friend_id,status")
    .eq("id", parsedId.id)
    .maybeSingle();
  const row = rowRaw as { id: string; user_id: string; friend_id: string; status: string } | null;
  if (row === null || row.status !== "pending") {
    // accept 已 accepted 幂等 200；其余非 pending 一律 404。
    if (row !== null && row.status === "accepted" && action === "accept") {
      return apiOk({ status: "accepted" as const });
    }
    return apiError("not_found", "请求不存在", 404);
  }
  const isRecipient = row.friend_id === userId;
  const isSender = row.user_id === userId;
  if ((action === "accept" || action === "decline") && !isRecipient) {
    return apiError("not_found", "请求不存在", 404);
  }
  if (action === "cancel" && !isSender) {
    return apiError("not_found", "请求不存在", 404);
  }
  // 拉黑任一方即 404（关系已变，不操作；只认 cheers_blocks 手动屏蔽，
  // chat_mutes 自动行不拦 accept——重加接受时成对清除，否则死结，见下）。
  const other = isRecipient ? row.user_id : row.friend_id;
  const { data: blocks } = await svc
    .from("cheers_blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${userId})`)
    .limit(1);
  if (Array.isArray(blocks) && blocks.length > 0) {
    return apiError("not_found", "请求不存在", 404);
  }

  if (action === "accept") {
    const { error: aErr } = await svc
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", row.id);
    if (aErr !== null) {
      console.error(`[api/v1/friends/requests] accept error: code=${aErr.code} message=${aErr.message}`);
      return apiError("internal", "接受失败", 500);
    }
    // 补反向行（缺即建，确保双向 accepted，沿 POST flip 口径）。
    const { data: reverse } = await svc
      .from("friendships")
      .select("id,status")
      .eq("user_id", row.friend_id)
      .eq("friend_id", row.user_id)
      .maybeSingle();
    if (reverse === null) {
      await svc.from("friendships").insert({
        user_id: row.friend_id,
        friend_id: row.user_id,
        status: "accepted",
      });
    } else if ((reverse as { status?: unknown }).status !== "accepted") {
      await svc
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", row.friend_id)
        .eq("friend_id", row.user_id);
    }
    // UR B.3 联调返工（交接 §六-2）：成对清除删好友自动禁言。
    // 重加流程不再需要双方手动 unblock——accept 成功即删双向 chat_mutes 行
    // （只清自动行，无手动入口故成对删安全；失败记 log 不拦接受本身）。
    // 注意：上方拉黑门只认 cheers_blocks（手动屏蔽），mute 不拦 accept，否则重加死结。
    const { error: unmuteErr } = await svc
      .from("chat_mutes")
      .delete()
      .or(
        `and(blocker_id.eq.${row.user_id},blocked_id.eq.${row.friend_id}),and(blocker_id.eq.${row.friend_id},blocked_id.eq.${row.user_id})`,
      );
    if (unmuteErr !== null) {
      console.error(`[api/v1/friends/requests] unmute error: code=${unmuteErr.code} message=${unmuteErr.message}`);
    }
    // 推送（after 语义：fire-and-forget，失败不影响接受本身）。
    after(() => {
      void sendFriendPush("accepted", { fromUserId: userId, toUserId: row.user_id });
    });
    return apiOk({ status: "accepted" as const });
  }
  if (action === "decline") {
    // 删入行＋清反向 pending（对方重发即新请求，无冷却，用户定案）。
    await svc.from("friendships").delete().eq("id", row.id);
    await svc
      .from("friendships")
      .delete()
      .eq("user_id", row.friend_id)
      .eq("friend_id", row.user_id)
      .eq("status", "pending");
    return apiOk({ status: "declined" as const });
  }
  // cancel：删己方行（对方行不动，对方意图保留）。
  await svc.from("friendships").delete().eq("id", row.id);
  return apiOk({ status: "cancelled" as const });
}
