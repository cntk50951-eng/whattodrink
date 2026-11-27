import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { generateTasteCard, loadCardRow } from "@/lib/tasteCardData";
import { tasteCardConsentGranted, tasteRefreshesLeft } from "@/lib/tasteCard";

/**
 * AI 口味卡（🔒，本人）。
 * `POST {force?}` —— 生成／刷新：自动（force 缺省）只在没卡或输入变了且≥24h 时重算；force=手动「重新生成」，限 3 次／24h。
 *   回 `{status: ok|unchanged|not_ready|rate_limited|failed, card, refreshes_left}`；资料不够（<2 类来源）回 not_ready，App 不显示 AI 卡。
 * `PATCH {visible}` —— 对他人隐藏／公开（0094 起默认只有自己；未同意时不能公开）。
 * `DELETE` —— 撤回口味卡 AI 同意：删掉卡片与同意记录，之后不再生成（App 私隐页「撤回 AI 同意」一并调用）。
 * IOS-C01：生成须有口味卡专属同意——已记录 consented_at，或本次 body 带 `consent: true`；否则回 200 `{status:"consent_required"}`。
 * 同步调模型（≤~30s）；App 在后台调，生成期间继续显示旧卡。
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: { force?: unknown; consent?: unknown } = {};
  try {
    body = (await req.json()) as { force?: unknown; consent?: unknown };
  } catch {
    body = {};
  }
  const apiKey = process.env.minimaxi_api_key ?? process.env.MINIMAXI_API_KEY ?? "";
  if (apiKey.length === 0) {
    console.error("[taste-card] minimaxi_api_key missing in environment");
    return apiError("internal", "AI 服务未配置。", 500);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const out = await generateTasteCard(svc, userId, apiKey, nowMs, body.force === true, body.consent);
  const row = await loadCardRow(svc, userId);
  const refreshesLeft = tasteRefreshesLeft(row?.refreshes, nowMs);
  if (out.status === "failed") return apiError("internal", "暂时生成不了，稍后再试。", 502);
  return apiOk({
    status: out.status,
    card: out.status === "ok" || out.status === "unchanged" ? out.card : null,
    refreshes_left: refreshesLeft,
  });
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let body: { visible?: unknown };
  try {
    body = (await req.json()) as { visible?: unknown };
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  if (typeof body.visible !== "boolean") return apiError("invalid_params", "visible 需为布尔", 400);
  const svc = await createServiceClient();
  // 没同意过的卡不能公开（IOS-C01）
  if (body.visible) {
    const row = await loadCardRow(svc, userId);
    if (row === null || !tasteCardConsentGranted(row.consented_at, undefined)) {
      return apiError("not_allowed", "请先同意用 AI 生成口味卡", 409);
    }
  }
  const { data, error } = await svc.from("user_taste_cards").update({ visible: body.visible }).eq("user_id", userId).select("user_id");
  if (error !== null) {
    console.error(`[taste-card] patch failed: ${error.code} ${error.message}`);
    return apiError("internal", "保存失败", 500);
  }
  // 还没有卡时没有行可改：返回成功但提示（隐藏偏好会在首次生成时默认公开——这种情况极少，App 只在有卡时才给开关）
  return apiOk({ visible: body.visible, updated: Array.isArray(data) && data.length > 0 });
}

/** 撤回口味卡 AI 同意（IOS-C01）：卡片與同意記錄一起刪掉；冪等（沒有也回成功） */
export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { error } = await svc.from("user_taste_cards").delete().eq("user_id", userId);
  if (error !== null) {
    console.error(`[taste-card] withdraw failed: ${error.code} ${error.message}`);
    return apiError("internal", "撤回失败", 500);
  }
  return apiOk({ withdrawn: true });
}
