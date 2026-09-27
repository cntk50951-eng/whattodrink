import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { validateGatheringInput, shouldBlockForMinor, checkRateLimit } from "@/lib/gatherings";

type Body = {
  title?: unknown;
  theme?: unknown;
  description?: unknown;
  location_text?: unknown;
  place_id?: unknown;
  lat?: unknown;
  lng?: unknown;
  venue_id?: unknown;
  starts_at?: unknown;
  capacity?: unknown;
  visibility?: unknown;
  approval_mode?: unknown;
  bring_text?: unknown;
  age_has_minor?: unknown;
  agreed?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);

  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const b = (raw ?? {}) as Body;

  const input = {
    title: String(b.title ?? ""),
    theme: String(b.theme ?? "friend_new") as Body["theme"] & string,
    description: String(b.description ?? ""),
    location_text: String(b.location_text ?? ""),
    place_id: String(b.place_id ?? ""),
    lat: typeof b.lat === "number" ? b.lat : Number(b.lat),
    lng: typeof b.lng === "number" ? b.lng : Number(b.lng),
    venue_id: (b.venue_id as string | null) ?? null,
    starts_at: String(b.starts_at ?? ""),
    capacity: typeof b.capacity === "number" ? b.capacity : Number(b.capacity),
    visibility: String(b.visibility ?? "public") as Body["visibility"] & string,
    approval_mode: String(b.approval_mode ?? "manual") as Body["approval_mode"] & string,
    bring_text: b.bring_text === null || b.bring_text === undefined ? null : String(b.bring_text),
    age_has_minor: b.age_has_minor as boolean | null,
    agreed: Boolean(b.agreed),
  } as Parameters<typeof validateGatheringInput>[0];

  // 五项审查 + 未成年一票否决
  if (shouldBlockForMinor(input)) {
    return apiError("invalid_params", "组局不允许未成年人参与，请确认参与者均已年满 18 岁", 422);
  }
  const errs = validateGatheringInput(input);
  if (errs.length > 0) {
    return apiError("invalid_params", errs[0]!.reason, 422);
  }

  // 频控：周发 2、进行中 1
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: weekly } = await supabase
      .from("gatherings")
      .select("id", { count: "exact", head: true })
      .eq("host_id", userId)
      .gte("created_at", weekAgo);
    const { count: ongoing } = await supabase
      .from("gatherings")
      .select("id", { count: "exact", head: true })
      .eq("host_id", userId)
      .in("status", ["open", "full", "ongoing"]);
    const rateErrs = checkRateLimit(weekly ?? 0, ongoing ?? 0);
    if (rateErrs.length > 0) return apiError("invalid_params", rateErrs[0]!.reason, 429);
  } catch {
    // 频控查询失败不阻断主流程（降级）
  }

  // 落库
  const startsAt = new Date(input.starts_at).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("gatherings")
    .insert({
      host_id: userId,
      title: input.title.trim(),
      theme: input.theme,
      description: input.description.trim(),
      location_text: input.location_text.trim(),
      place_id: input.place_id,
      lat: input.lat,
      lng: input.lng,
      venue_id: input.venue_id ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      capacity: input.capacity,
      visibility: input.visibility,
      approval_mode: input.approval_mode,
      bring_text: input.bring_text?.trim() ? input.bring_text.trim() : null,
      age_has_minor: false,
      status: "open",
    })
    .select("id,host_id,title,theme,description,location_text,place_id,lat,lng,starts_at,ends_at,capacity,visibility,approval_mode,status,created_at")
    .single();

  if (error || data === null) {
    console.error(`[api/v1/gatherings] insert error: ${error?.code} ${error?.message}`);
    return apiError("internal", "组局创建失败", 500);
  }

  // 预置 host 成员
  await supabase.from("gathering_members").insert({
    gathering_id: (data as { id: string }).id,
    user_id: userId,
    role: "host",
  });

  return apiOk({ gathering: data }, 201);
}

// 发现列表（F.2 用，F.1 先占位只读，public 全员可见）
export async function GET(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const { data, error } = await supabase
    .from("gatherings")
    .select("id,host_id,title,theme,description,location_text,lat,lng,starts_at,capacity,visibility,status,created_at")
    .eq("status", "open")
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) return apiError("internal", "读取失败", 500);
  // friends 可见性在应用层二次过滤（MVP 先只回 public + 自己的）
  const filtered = (data ?? []).filter((g: { visibility: string; host_id: string }) => g.visibility === "public" || g.host_id === userId);
  return apiOk({ gatherings: filtered });
}
