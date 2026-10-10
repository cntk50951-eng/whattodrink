import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { sendGameInvitePush } from "@/lib/push/send";
import {
  hasBlockOrMute,
  isFriend,
  loadRoomAsMember,
  parseInviteBody,
  requireHost,
} from "@/lib/games/rooms";

/**
 * UR H.1 邀请（🔒，仅房主，仅 lobby）。
 * `POST /api/v1/games/rooms/{id}/invites {user_ids:[...] ≤7}`
 * —— 200 `{invited:[...], skipped:[{user_id, reason}]}`。
 * 门（逐人）：只能邀好友（not_friend）／双表无拉黑解友（blocked）／
 * 非在场成员（member）／pending 去重幂等（已有即 invited，不重推）。
 * 不 bump room version（邀请不改变房间状态）；新邀 after() 推 game_invite。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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
  const parsed = parseInviteBody(raw, userId);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { id } = await params;
  const svc = await createServiceClient();
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  const { room, members } = loaded;
  if (room.status !== "lobby") {
    return apiError("wrong_phase", "對局已開始，不可再邀", 409);
  }
  const memberIds = new Set(members.map((m) => m.user_id));
  const invited: string[] = [];
  const skipped: { user_id: string; reason: string }[] = [];
  const freshPush: { toUserId: string }[] = [];
  for (const target of parsed.userIds) {
    if (memberIds.has(target)) {
      skipped.push({ user_id: target, reason: "member" });
      continue;
    }
    if (await hasBlockOrMute(svc, userId, target)) {
      skipped.push({ user_id: target, reason: "blocked" });
      continue;
    }
    if (!(await isFriend(svc, userId, target))) {
      skipped.push({ user_id: target, reason: "not_friend" });
      continue;
    }
    const { data: existing } = await svc
      .from("game_invites")
      .select("id")
      .eq("room_id", room.id)
      .eq("to_user_id", target)
      .eq("status", "pending")
      .maybeSingle();
    if (existing !== null) {
      invited.push(target);
      continue;
    }
    const { error } = await svc.from("game_invites").insert({
      room_id: room.id,
      from_user_id: userId,
      to_user_id: target,
      status: "pending",
    });
    if (error !== null) {
      // 并发重邀撞 partial unique 即幂等成功。
      if (error.code === "23505") {
        invited.push(target);
        continue;
      }
      console.error(`[games/invites] insert error: code=${error.code} message=${error.message}`);
      skipped.push({ user_id: target, reason: "internal" });
      continue;
    }
    invited.push(target);
    freshPush.push({ toUserId: target });
  }
  if (freshPush.length > 0) {
    after(() => {
      void Promise.all(
        freshPush.map((f) =>
          sendGameInvitePush({ fromUserId: userId, toUserId: f.toUserId, roomId: room.id, code: room.code }),
        ),
      );
    });
  }
  return apiOk({ invited, skipped });
}
