import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isStealthUser, loadRoomAsMember, requireHost } from "@/lib/games/rooms";
import { issueBumpToken } from "@/lib/games/bump";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";

/**
 * 蓝牙碰一碰：房主取凭证（仅房主，仅 lobby）。
 * `POST /api/v1/games/rooms/{id}/bump-token` —— 200 `{token, expires_at}`。
 * 房主 App 打开「碰一碰」面板后每 30 秒换一枚，通过 BLE 特征值给贴近的手机读。
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
  const svc = await createServiceClient();
  if (await isStealthUser(svc, userId)) {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
  const loaded = await loadRoomAsMember(svc, id, userId);
  if ("response" in loaded) return loaded.response;
  const hostErr = requireHost(loaded, userId);
  if (hostErr !== null) return hostErr.response;
  if (loaded.room.status !== "lobby") {
    return apiError("wrong_phase", "對局已開始，不可再加人", 409);
  }
  const issued = issueBumpToken(loaded.room.id, Date.now());
  if (issued === null) {
    return apiError("internal", "暫時未能開啟碰一碰", 503);
  }
  return apiOk({ token: issued.token, expires_at: issued.expiresAt });
}
