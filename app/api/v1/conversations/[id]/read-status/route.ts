import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseConversationId } from "@/lib/api/chat";

/**
 * UR D.4 對方讀水位（🔒）。
 * `GET /api/v1/conversations/:id/read-status` —— 回對方 `last_read_at`
 * （頁內已讀✓✓翻態用；RLS 讀不到對方水位行，故開此端點，server 代查；
 * 非成員一律 404 fail-closed）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  const parsedId = parseConversationId(id);
  if ("error" in parsedId) {
    return apiError("invalid_params", parsedId.error, 400);
  }
  // 先 authed 驗我是成員（fail-closed），再 service 讀對方水位行
  // （RLS 只許讀自己行，authed 拿不到對方，沿列表端點同修）。
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", parsedId.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mine === null) {
    return apiError("not_found", "找不到该会话", 404);
  }
  const svc = await createServiceClient();
  const { data: members } = await svc
    .from("conversation_members")
    .select("user_id,last_read_at")
    .eq("conversation_id", parsedId.id);
  const rows = ((members ?? []) as unknown[]) as {
    user_id: string;
    last_read_at: string;
  }[];
  const peer = rows.find((m) => m.user_id !== userId) ?? null;
  const peer_last_read_at =
    peer !== null && Number.isFinite(Date.parse(peer.last_read_at))
      ? Date.parse(peer.last_read_at)
      : null;
  return apiOk({ peer_last_read_at });
}
