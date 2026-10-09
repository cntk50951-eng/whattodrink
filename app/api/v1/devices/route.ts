import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

const PLATFORMS = ["web", "ios", "aos"] as const;
const ENVS = ["sandbox", "production"] as const;
const MAX_DEVICES = 10;

type DeviceBody = {
  platform?: unknown;
  push_token?: unknown;
  environment?: unknown;
  app_version?: unknown;
  locale?: unknown;
};

function parseToken(raw: unknown): { platform: string; push_token: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  if (typeof r.platform !== "string" || !(PLATFORMS as readonly string[]).includes(r.platform)) {
    return { error: "platform 非法" };
  }
  if (
    typeof r.push_token !== "string" ||
    !/^[0-9a-fA-F]{64,200}$/.test(r.push_token)
  ) {
    return { error: "push_token 非法（hex 64–200）" };
  }
  return { platform: r.platform, push_token: r.push_token };
}

/**
 * UR D.9 设备登记（🔒）。
 * `POST /api/v1/devices {platform, push_token, environment?, app_version?, locale?}` ——
 * upsert（platform, push_token）：存在即 re-bind 给当前用户（换号转移）＋刷新字段；
 * 不存在即插；超 10 台删最旧。回 `{id}`（token 永不回客户端，沿 §143）。
 * 写走 service（re-bind 跨 owner，RLS 表达不了；user 限域全代码判）。
 */
export async function POST(req: Request): Promise<Response> {
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
  const idParsed = parseToken(raw);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  const r = raw as DeviceBody;
  const environment =
    r.environment === undefined
      ? "production"
      : typeof r.environment === "string" && (ENVS as readonly string[]).includes(r.environment)
        ? r.environment
        : null;
  if (environment === null) return apiError("invalid_params", "environment 非法", 400);
  const appVersion =
    r.app_version === undefined || r.app_version === null
      ? null
      : typeof r.app_version === "string"
        ? r.app_version.slice(0, 32)
        : null;
  if (r.app_version !== undefined && r.app_version !== null && appVersion === null) {
    return apiError("invalid_params", "app_version 非法", 400);
  }
  const locale =
    r.locale === undefined || r.locale === null
      ? null
      : typeof r.locale === "string"
        ? r.locale.slice(0, 16)
        : null;
  if (r.locale !== undefined && r.locale !== null && locale === null) {
    return apiError("invalid_params", "locale 非法", 400);
  }
  const supa = await createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: upserted, error: uErr } = await supa
    .from("devices")
    .upsert(
      {
        user_id: userId,
        platform: idParsed.platform,
        push_token: idParsed.push_token,
        environment,
        app_version: appVersion,
        locale,
        enabled: true,
        last_seen_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "platform,push_token" },
    )
    .select("id")
    .maybeSingle();
  if (uErr !== null || upserted === null) {
    console.error(`[api/v1/devices] upsert error: code=${uErr?.code} message=${uErr?.message}`);
    return apiError("internal", "登记失败", 500);
  }
  // 10 台顶旧（同用户按 updated 倒序留 10）。
  const { data: mine } = await supa
    .from("devices")
    .select("id,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_DEVICES + 5);
  const rows = ((mine ?? []) as unknown[]) as { id: string }[];
  if (rows.length > MAX_DEVICES) {
    const drop = rows.slice(MAX_DEVICES).map((d) => d.id);
    await supa.from("devices").delete().in("id", drop);
  }
  return apiOk({ id: (upserted as { id: string }).id });
}

/**
 * UR D.9 解绑（🔒，幂等）。
 * `DELETE /api/v1/devices {platform, push_token}` —— 删行（登出／关通知时调）；
 * 找不到也 200。
 */
export async function DELETE(req: Request): Promise<Response> {
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
  const idParsed = parseToken(raw);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  const supa = await createServiceClient();
  const { error } = await supa
    .from("devices")
    .delete()
    .eq("platform", idParsed.platform)
    .eq("push_token", idParsed.push_token)
    .eq("user_id", userId);
  if (error !== null) {
    console.error(`[api/v1/devices] delete error: code=${error.code} message=${error.message}`);
    return apiError("internal", "解绑失败", 500);
  }
  return apiOk({ deleted: true });
}

/**
 * UR D.9 设备更新（🔒）。
 * `PATCH /api/v1/devices {platform, push_token, enabled?, locale?}` ——
 * 只改本人名下该行；找不到 404。
 */
export async function PATCH(req: Request): Promise<Response> {
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
  const idParsed = parseToken(raw);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  const r = raw as Record<string, unknown>;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (r.enabled !== undefined) {
    if (typeof r.enabled !== "boolean") {
      return apiError("invalid_params", "enabled 须为 boolean", 400);
    }
    update.enabled = r.enabled;
  }
  if (r.locale !== undefined) {
    if (r.locale !== null && typeof r.locale !== "string") {
      return apiError("invalid_params", "locale 非法", 400);
    }
    update.locale = typeof r.locale === "string" ? r.locale.slice(0, 16) : null;
  }
  if (Object.keys(update).length === 1) {
    return apiError("invalid_params", "body 無有效字段", 400);
  }
  const supa = await createServiceClient();
  const { data, error } = await supa
    .from("devices")
    .update(update)
    .eq("platform", idParsed.platform)
    .eq("push_token", idParsed.push_token)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error !== null) {
    console.error(`[api/v1/devices] patch error: code=${error.code} message=${error.message}`);
    return apiError("internal", "更新失败", 500);
  }
  if (data === null) return apiError("not_found", "设备不存在", 404);
  return apiOk({ updated: true });
}
