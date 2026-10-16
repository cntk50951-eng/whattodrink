import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { normalizeHashtag } from "@/lib/hashtags";

/**
 * 我的自定義標籤庫（🔒，本人）。
 * `GET` → `{hashtags:[{tag,uses,last_used_at}]}`（最近使用在前，最多 100）；0061 未跑回空。
 * `PATCH {tag, rename_to}` 改名（只改標籤庫，已發的打卡不變；新名已存在則合併次數）。
 * `DELETE {tag}` 從標籤庫移除（只影響聯想，已發的打卡不變）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("user_hashtags")
    .select("tag,uses,last_used_at")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false })
    .limit(100);
  if (error !== null) return apiOk({ hashtags: [] });
  return apiOk({ hashtags: ((data ?? []) as unknown[]).filter((r) => typeof (r as { tag?: unknown }).tag === "string") });
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = (await req.json()) as unknown;
    return typeof b === "object" && b !== null ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function PATCH(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const body = await readBody(req);
  const tag = normalizeHashtag(body?.tag);
  const next = normalizeHashtag(body?.rename_to);
  if (tag === null || next === null) return apiError("invalid_params", "tag／rename_to 非法（1-12 字，仅文字／数字／_-·）", 400);
  const svc = await createServiceClient();
  const { data: rows, error } = await svc.from("user_hashtags").select("tag,uses,last_used_at").eq("user_id", userId).in("tag", [tag, next]);
  if (error !== null) return apiError("internal", "保存失败", 500);
  const list = ((rows ?? []) as unknown[]) as { tag: string; uses: number; last_used_at: string }[];
  const old = list.find((r) => r.tag === tag);
  if (!old) return apiError("not_found", "标签不存在", 404);
  if (tag !== next) {
    const exist = list.find((r) => r.tag === next);
    const uses = old.uses + (exist?.uses ?? 0);
    const last = [old.last_used_at, exist?.last_used_at].filter((x): x is string => typeof x === "string").sort().pop() ?? new Date().toISOString();
    const up = await svc.from("user_hashtags").upsert({ user_id: userId, tag: next, uses, last_used_at: last }, { onConflict: "user_id,tag" });
    if (up.error !== null) return apiError("internal", "保存失败", 500);
    await svc.from("user_hashtags").delete().eq("user_id", userId).eq("tag", tag);
  }
  return apiOk({ tag: next });
}

export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  const body = await readBody(req);
  const tag = normalizeHashtag(body?.tag);
  if (tag === null) return apiError("invalid_params", "tag 非法", 400);
  const svc = await createServiceClient();
  const { error } = await svc.from("user_hashtags").delete().eq("user_id", userId).eq("tag", tag);
  if (error !== null) return apiError("internal", "删除失败", 500);
  return apiOk({ deleted: tag });
}
