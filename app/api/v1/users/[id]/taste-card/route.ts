import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { loadCardRow, loadTasteInputs } from "@/lib/tasteCardData";
import { tasteCardNeedsRefresh, tasteCardReady, tasteInputsHash, tasteRefreshesLeft, type TasteCard } from "@/lib/tasteCard";

/**
 * AI 口味卡读取（🔒；id 或 `me`）。只读缓存，永不触发生成（生成走 POST /me/taste-card）。
 * 他人视角：对方没生成过／已隐藏／拉黑 → `{card:null}`；本人视角额外带 visible／ready／stale／refreshes_left。
 * 表未迁移（0059 没跑）→ `{card:null}`，不炸。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const { id } = await params;
  const targetId = id === "me" ? userId : id;
  if (typeof targetId !== "string" || targetId === "" || targetId.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const svc = await createServiceClient();
  const row = await loadCardRow(svc, targetId);
  const card = row !== null && typeof row.payload === "object" && row.payload !== null ? (row.payload as TasteCard) : null;
  if (targetId !== userId) {
    const { data: blockRows } = await svc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
      .limit(1);
    if (Array.isArray(blockRows) && blockRows.length > 0) return apiError("not_found", "用户不存在", 404);
    return apiOk({ card: row !== null && row.visible ? card : null });
  }
  // 本人：告诉 App 现在是否值得（后台）生成一次
  const inputs = await loadTasteInputs(svc, userId);
  const ready = tasteCardReady(inputs);
  const stale = ready && tasteCardNeedsRefresh(row === null ? null : { inputs_hash: row.inputs_hash, computed_at: row.computed_at }, tasteInputsHash(inputs), Date.now());
  return apiOk({
    card,
    visible: row?.visible ?? true,
    ready,
    stale,
    refreshes_left: tasteRefreshesLeft(row?.refreshes, Date.now()),
  });
}
