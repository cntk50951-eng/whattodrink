import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

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
  if (action !== "accept" && action !== "decline" && action !== "recall") {
    return apiError("invalid_params", "action 只要 accept｜decline｜recall", 400);
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
  if (row.status !== "sent") {
    return apiError("invalid_params", "邀約已不在等待中", 400);
  }
  const expired =
    typeof row.expires_at === "string" && Date.parse(row.expires_at) < Date.now();
  if (action === "recall") {
    if (row.from_user_id !== userId) return apiError("forbidden", "只能撤回自己發的", 403);
    const { error } = await supabase
      .from("drink_invites")
      .update({ status: "recalled" })
      .eq("id", id)
      .eq("status", "sent");
    if (error !== null) {
      console.error(`[api/v1/invites] recall error: code=${error.code} message=${error.message}`);
      return apiError("internal", "撤回失敗", 500);
    }
    return apiOk({ recalled: true });
  }
  if (row.to_user_id !== userId) return apiError("forbidden", "只能回應收到的邀約", 403);
  if (expired) return apiError("invalid_params", "邀約已過期", 410);
  if (action === "decline") {
    const { error } = await supabase
      .from("drink_invites")
      .update({ status: "declined" })
      .eq("id", id)
      .eq("status", "sent");
    if (error !== null) {
      console.error(`[api/v1/invites] decline error: code=${error.code} message=${error.message}`);
      return apiError("internal", "操作失敗", 500);
    }
    return apiOk({ declined: true });
  }
  // accept：置 accepted＋双向 accepted 落库（service 凭明确同意事件；RLS 只许 pending）。
  const service = await createServiceClient();
  const { error: uErr } = await supabase
    .from("drink_invites")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("status", "sent");
  if (uErr !== null) {
    console.error(`[api/v1/invites] accept error: code=${uErr.code} message=${uErr.message}`);
    return apiError("internal", "接受失敗", 500);
  }
  const pair = [
    { user_id: row.from_user_id, friend_id: row.to_user_id, status: "accepted" },
    { user_id: row.to_user_id, friend_id: row.from_user_id, status: "accepted" },
  ];
  const { error: fErr } = await service.from("friendships").upsert(pair, {
    onConflict: "user_id,friend_id",
  });
  if (fErr !== null) {
    console.error(`[api/v1/invites] befriend error: code=${fErr.code} message=${fErr.message}`);
  }
  const { data: peerRow } = await supabase
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
