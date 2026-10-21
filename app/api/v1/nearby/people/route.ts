import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { ONLINE_WINDOW_MS } from "@/lib/nearby";
import {
  NEARBY_PEOPLE_LIMIT,
  parseRadiusKm,
  sortNearby,
  tasteGroupsOf,
  toNearbyCandidate,
  type NearbyCandidate,
  type NearbyPerson,
  type NearbyUserRow,
} from "@/lib/nearbyPeople";

const POOL_CAP = 300;

/**
 * 附近的人 `GET /api/v1/nearby/people?radius_km=3`（🔒）。
 * 目的：發現附近在線的陌生酒友，之後打招呼（開聊天，陌生人 3 條限制沿現有）／約酒。
 * 回 `{people, radius_km, needs_location}`：
 * - 查看者隱身 → `people: []`（自己不暴露也不看別人，沿 friends/live 口徑）；
 * - 查看者位置＝自己 5 分鐘內心跳的 live 坐標；沒有就回 `needs_location: true`；
 * - 候選＝心跳窗內、非隱身、成年、在半徑內、不在雙向拉黑／聊天屏蔽裡、不是自己；
 * - **不回精確距離與坐標**，只回距離檔（lib/nearbyPeople.ts `DISTANCE_BANDS_M`）；
 * - 排序：本次上線時間新→舊，再距離近→遠；最多 50 人。
 * 搜索者門：需完成性別＋生日並已成年（沿遇見 I.1）。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const radiusKm = parseRadiusKm(new URL(req.url).searchParams.get("radius_km"));
  if (radiusKm === null) {
    return apiError("invalid_params", "radius_km 需为正数", 400);
  }
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: meRow } = await svc
    .from("users")
    .select("mode,gender,dob,preferences,last_seen_at,live_lat,live_lng")
    .eq("id", userId)
    .maybeSingle();
  const me = (meRow ?? {}) as Record<string, unknown>;
  if (me.mode === "stealth") {
    return apiOk({ people: [], radius_km: radiusKm, needs_location: false });
  }
  if ((me.gender !== "male" && me.gender !== "female") || typeof me.dob !== "string" || me.dob === "") {
    return apiError("onboarding_required", "請先完成性別與生日", 403);
  }
  if (isMinorDob(me.dob, nowMs)) {
    return apiError("age_restricted", "未滿 18 歲不可用附近的人", 403);
  }
  const seen = typeof me.last_seen_at === "string" ? Date.parse(me.last_seen_at) : NaN;
  if (
    !Number.isFinite(seen) ||
    nowMs - seen > ONLINE_WINDOW_MS ||
    typeof me.live_lat !== "number" ||
    typeof me.live_lng !== "number"
  ) {
    return apiOk({ people: [], radius_km: radiusKm, needs_location: true });
  }
  const viewer = { lat: me.live_lat, lng: me.live_lng };
  // bbox 預過濾（1° 緯度≈111km；經度按緯度收縮），精確半徑在 toNearbyCandidate 裡再算。
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((viewer.lat * Math.PI) / 180)));
  const since = new Date(nowMs - ONLINE_WINDOW_MS).toISOString();
  const cols = "id,nickname,avatar_url,gender,dob,mode,preferences,last_seen_at,live_lat,live_lng";
  let pool: unknown[] | null = null;
  {
    const q = (select: string) =>
      svc
        .from("users")
        .select(select)
        .neq("id", userId)
        .neq("mode", "stealth")
        .gte("last_seen_at", since)
        .gte("live_lat", viewer.lat - dLat)
        .lte("live_lat", viewer.lat + dLat)
        .gte("live_lng", viewer.lng - dLng)
        .lte("live_lng", viewer.lng + dLng)
        .order("last_seen_at", { ascending: false })
        .limit(POOL_CAP);
    let r = await q(`${cols},online_since`);
    if (r.error !== null && /online_since/.test(r.error.message ?? "")) {
      r = await q(cols); // 0065 還沒上：回退，online_since 由讀端用 last_seen_at 代
    }
    if (r.error !== null) {
      return apiError("internal", "读取附近的人失败", 500);
    }
    pool = (r.data ?? []) as unknown[];
  }
  const rows = pool as NearbyUserRow[];
  const ids = rows.map((r) => r.id).filter((x): x is string => typeof x === "string");
  if (ids.length === 0) {
    return apiOk({ people: [], radius_km: radiusKm, needs_location: false });
  }
  const [{ data: blocks }, { data: mutes }, { data: fs }] = await Promise.all([
    svc.from("cheers_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`).limit(2000),
    svc.from("chat_mutes").select("blocker_id,blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`).limit(2000),
    svc.from("friendships").select("user_id,friend_id,status").or(`user_id.eq.${userId},friend_id.eq.${userId}`).limit(2000),
  ]);
  const hidden = new Set<string>();
  for (const list of [blocks, mutes]) {
    for (const b of ((list ?? []) as unknown[]) as { blocker_id?: unknown; blocked_id?: unknown }[]) {
      if (typeof b.blocker_id === "string" && typeof b.blocked_id === "string") {
        hidden.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
      }
    }
  }
  const rel = new Map<string, NearbyPerson["relationship"]>();
  for (const e of ((fs ?? []) as unknown[]) as { user_id?: unknown; friend_id?: unknown; status?: unknown }[]) {
    if (typeof e.user_id !== "string" || typeof e.friend_id !== "string") continue;
    const peer = e.user_id === userId ? e.friend_id : e.user_id;
    if (e.status === "accepted") rel.set(peer, "friend");
    else if (e.status === "pending" && !rel.has(peer)) rel.set(peer, e.user_id === userId ? "pending_out" : "pending_in");
  }
  const myGroups = tasteGroupsOf(me.preferences, 8);
  const cands: NearbyCandidate[] = [];
  for (const r of rows) {
    if (typeof r.id !== "string" || hidden.has(r.id)) continue;
    const c = toNearbyCandidate(r, viewer, radiusKm, myGroups, rel.get(r.id) ?? "none", nowMs);
    if (c !== null) cands.push(c);
  }
  const people = sortNearby(cands).slice(0, NEARBY_PEOPLE_LIMIT);
  return apiOk({ people, radius_km: radiusKm, needs_location: false });
}
