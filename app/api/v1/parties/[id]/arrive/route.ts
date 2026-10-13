import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { haversineMeters } from "@/lib/geo";
import { ipRateLimit } from "@/lib/rateLimit";
import { TRUST_CONFIG } from "@/lib/trust/config";
import { roundDistance50m } from "@/lib/trust/settle";

/**
 * UR E.31 C1 到场打卡（🔒）。
 * `POST /api/v1/parties/:id/arrive {lat, lng}` —— 仅名单内（host 或 joins）；
 * 窗口＝开局前后 30min（服务端时间），外 409 `arrive_window_closed`；
 * 距酒吧 >300m 即 409 `too_far`（message 距离取整 50m，防反推）；
 * **只存 `arrived_at`，不存坐标**（隐私文案见 openapi）；重复打卡幂等；
 * 每人每局 10 次尝试（进程级限流，防刷定位）。
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
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (typeof r.lat !== "number" || !Number.isFinite(r.lat) || Math.abs(r.lat) > 90) {
    return apiError("invalid_params", "lat 非法", 400);
  }
  if (typeof r.lng !== "number" || !Number.isFinite(r.lng) || Math.abs(r.lng) > 180) {
    return apiError("invalid_params", "lng 非法", 400);
  }
  if (!ipRateLimit(`arrive:${id}:${userId}`, Date.now(), 3600_000, TRUST_CONFIG.arrive_attempts_cap).ok) {
    return apiError("rate_limited", "嘗試太頻繁，稍後再試", 429);
  }
  const svc = await createServiceClient();
  const { data: party } = await svc
    .from("parties")
    .select("id,host_user_id,status,start_at,lat,lng")
    .eq("id", id)
    .maybeSingle();
  const p = party as {
    id?: unknown;
    host_user_id?: unknown;
    status?: unknown;
    start_at?: unknown;
    lat?: unknown;
    lng?: unknown;
  } | null;
  if (p === null || typeof p.id !== "string") return apiError("not_found", "酒局不存在", 404);
  if (p.status === "cancelled") return apiError("not_found", "酒局不存在", 404);
  const nowMs = Date.now();
  const startMs = typeof p.start_at === "string" ? Date.parse(p.start_at) : NaN;
  if (
    !Number.isFinite(startMs) ||
    nowMs < startMs - TRUST_CONFIG.arrive_before_min * 60_000 ||
    nowMs > startMs + TRUST_CONFIG.arrive_after_min * 60_000
  ) {
    return apiError("arrive_window_closed", "未到打卡時間（開局前後 30 分鐘內）", 409);
  }
  const isHost = p.host_user_id === userId;
  if (!isHost) {
    const { data: join } = await svc
      .from("joins")
      .select("user_id")
      .eq("party_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (join === null) return apiError("not_in_party", "你不在該酒局名單", 403);
  }
  if (typeof p.lat !== "number" || typeof p.lng !== "number") {
    return apiError("internal", "酒吧位置缺失", 500);
  }
  const dist = haversineMeters({ lat: r.lat, lng: r.lng }, { lat: p.lat, lng: p.lng });
  if (dist > TRUST_CONFIG.arrive_radius_m) {
    return apiError("too_far", `距離酒吧約 ${roundDistance50m(dist)} 米`, 409);
  }
  const nowIso = new Date(nowMs).toISOString();
  const { error } = await svc.from("party_attendance").upsert(
    { party_id: id, user_id: userId, arrived_at: nowIso },
    { onConflict: "party_id,user_id" },
  );
  if (error !== null) {
    console.error(`[api/v1/parties/arrive] upsert error: code=${error.code} message=${error.message}`);
    return apiError("internal", "打卡失敗", 500);
  }
  return apiOk({ arrived: true, arrived_at: nowIso });
}
