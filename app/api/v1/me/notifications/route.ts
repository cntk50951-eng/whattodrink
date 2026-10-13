import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

/**
 * 阶段 A 站内通知列表（🔒）。
 * `GET /api/v1/me/notifications?limit=&cursor=` —— `{unread, items}`（created 倒序；
 * cursor＝created_at ISO keyset；limit 1–50 默认 20）。
 * 行：`{id, kind, party_id, actor{user_id,nickname,avatar_url}|null, payload, created_at, read}`。
 * 只读本人行（service＋userId 限域；通知表零 policy，沿 push_log）。
 * 本期 kind：party_cancelled／member_left／member_left_late。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const q = new URL(req.url).searchParams;
  const limitRaw = Number(q.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 20;
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;
  const svc = await createServiceClient();
  const { count: unread } = await svc
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  let query = svc
    .from("notifications")
    .select("id,kind,party_id,actor_id,payload,created_at,read_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (Number.isFinite(cursorMs)) {
    query = query.lt("created_at", new Date(cursorMs).toISOString());
  }
  const { data: rows, error } = await query;
  if (error !== null) {
    console.error(`[api/v1/me/notifications] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "通知讀取失敗", 500);
  }
  const list = ((rows ?? []) as unknown[]).slice(0, limit + 1);
  const page = list.slice(0, limit);
  const actorIds = [
    ...new Set(
      (page as Record<string, unknown>[])
        .map((r) => r.actor_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const actorById = new Map<string, { nickname: string; avatar_url: string | null }>();
  if (actorIds.length > 0) {
    const { data: actors } = await svc.from("users").select("id,nickname,avatar_url").in("id", actorIds);
    for (const a of ((actors ?? []) as unknown[]) as Record<string, unknown>[]) {
      if (typeof a.id !== "string") continue;
      actorById.set(a.id, {
        nickname: typeof a.nickname === "string" && a.nickname !== "" ? a.nickname : "酒友",
        avatar_url: typeof a.avatar_url === "string" ? a.avatar_url : null,
      });
    }
  }
  const items = (page as Record<string, unknown>[]).map((r) => {
    const actorId = typeof r.actor_id === "string" ? r.actor_id : null;
    const actor = actorId !== null ? actorById.get(actorId) ?? null : null;
    return {
      id: r.id,
      kind: r.kind,
      party_id: typeof r.party_id === "string" ? r.party_id : null,
      actor: actor !== null && actorId !== null ? { user_id: actorId, ...actor } : null,
      payload: typeof r.payload === "object" && r.payload !== null ? r.payload : {},
      created_at: r.created_at,
      read: r.read_at !== null && r.read_at !== undefined,
    };
  });
  const nextCursor =
    list.length > limit && page.length > 0
      ? (page[page.length - 1] as Record<string, unknown>).created_at ?? null
      : null;
  return apiOk({ unread: unread ?? 0, items, nextCursor });
}
