import { getAuthedClient, getUserId } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { countGenders, hkDayStartISO, parsePartyBody, partyExpiresAt } from "@/lib/api/party";
import { haversineMeters } from "@/lib/geo";

/**
 * UR E.23 發攢局（🔒，匿名 401；隐身／未成年 403；3／天 429；iOS-0.57 联调）。
 * `POST /api/v1/parties` —— 總量 2–12、男女和≤總量、門檻 2..總量、
 * `start_at` 未来 14 天内；host 不自動占席（joined_count 從 0 起，用戶定案 2026-10-08）。
 * 回 `201 {id, expires_at}`（`expires_at`＝`start_at`＋3h，問答定案）。
 */
export async function POST(req: Request): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const parsed = parsePartyBody(raw);
  if ("error" in parsed) {
    return apiError("invalid_params", parsed.error, 400);
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode,dob")
    .eq("id", userId)
    .maybeSingle();
  const me = (meRow ?? {}) as { mode?: unknown; dob?: unknown };
  if (me.mode === "stealth") {
    return apiError("forbidden", "隱身模式不可發局", 403);
  }
  if (isMinorDob(me.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可發局", 403);
  }
  const { count: dayCount } = await supabase
    .from("parties")
    .select("id", { count: "exact", head: true })
    .eq("host_user_id", userId)
    .gte("created_at", hkDayStartISO(Date.now()));
  if ((dayCount ?? 0) >= 3) {
    return apiError("rate_limited", "今日發局已達上限（3 次）", 429);
  }
  const b = parsed.body;
  const startMs = Date.parse(b.start_at);
  const expiresIso = new Date(partyExpiresAt(startMs)).toISOString();
  const { data: inserted, error: iErr } = await supabase
    .from("parties")
    .insert({
      host_user_id: userId,
      place: b.place,
      poi_id: b.poi_id ?? null,
      city: b.city,
      lat: b.lat,
      lng: b.lng,
      start_at: b.start_at,
      expires_at: expiresIso,
      seats_total: b.seats_total,
      seats_male: b.seats_male,
      seats_female: b.seats_female,
      min_members: b.min_members,
      bill_intent: b.bill_intent,
      status: "open",
    })
    .select("id")
    .single();
  if (iErr !== null || inserted === null) {
    console.error(`[api/v1/parties] insert error: code=${iErr?.code} message=${iErr?.message}`);
    return apiError("internal", "發局失敗", 500);
  }
  const pid = (inserted as { id: string }).id;
  // host 不自動占席（用戶定案 2026-10-08）：joined_count 從 0 起，host 另行参加才占位。
  return apiOk({ id: pid, expires_at: expiresIso }, 201);
}

type PartyListRow = {
  id: string;
  host_user_id: string;
  place: string;
  city: string;
  lat: number;
  lng: number;
  start_at: string;
  expires_at: string;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  min_members: number;
  bill_intent: string;
  status: string;
  created_at: string;
};

/**
 * UR E.23 看板列表（🌐匿名可看；iOS-0.57 联调）。
 * `GET /api/v1/parties?city=&bbox=&near=lat,lng&limit=&cursor=` —— 只回
 * 未过期非 cancelled；行含計數＋host＋本人旗＋距離（`near` 一次性查询用，不存储）。
 * cursor＝created_at ISO（keyset 下一页；仍按 created 倒序）。
 */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const limitRaw = Number(q.get("limit"));
  const limit =
    Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 50 ? limitRaw : 20;
  const city = (q.get("city") ?? "").trim().slice(0, 30);
  const nearRaw = q.get("near");
  let near: { lat: number; lng: number } | null = null;
  if (nearRaw !== null) {
    const [la, ln] = nearRaw.split(",").map(Number);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      near = { lat: la, lng: ln };
    }
  }
  let bbox: { west: number; south: number; east: number; north: number } | null = null;
  const bboxRaw = q.get("bbox");
  if (bboxRaw !== null) {
    const [w, s, e, n] = bboxRaw.split(",").map(Number);
    if ([w, s, e, n].every(Number.isFinite) && w < e && s < n) {
      bbox = { west: w, south: s, east: e, north: n };
    }
  }
  const cursor = q.get("cursor");
  const cursorMs = cursor !== null ? Date.parse(cursor) : NaN;

  const { supabase } = await getAuthedClient(req);
  const viewerId = await getUserId().catch(() => null);
  const nowIso = new Date(Date.now()).toISOString();

  let query = supabase
    .from("parties")
    .select(
      "id,host_user_id,place,city,lat,lng,start_at,expires_at,seats_total,seats_male,seats_female,min_members,bill_intent,status,created_at",
    )
    .eq("status", "open")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (city !== "") query = query.eq("city", city);
  if (bbox !== null) {
    query = query
      .gte("lat", bbox.south)
      .lte("lat", bbox.north)
      .gte("lng", bbox.west)
      .lte("lng", bbox.east);
  }
  if (Number.isFinite(cursorMs)) {
    query = query.lt("created_at", new Date(cursorMs).toISOString());
  }
  const { data: rows, error } = await query;
  if (error !== null) {
    console.error(`[api/v1/parties] list error: code=${error.code} message=${error.message}`);
    return apiError("internal", "酒局讀取失敗", 500);
  }
  const list = ((rows ?? []) as PartyListRow[]).filter((r) => typeof r.id === "string");
  const ids = list.map((r) => r.id);
  const hostIds = [...new Set(list.map((r) => r.host_user_id))];
  let hosts = new Map<string, { nickname: string; avatar_url: string | null }>();
  const joinCounts = new Map<string, number>();
  const gendersByParty = new Map<string, (string | null)[]>();
  const mine = new Set<string>();
  if (ids.length > 0) {
    const { data: joins } = await supabase
      .from("joins")
      .select("party_id,user_id")
      .in("party_id", ids);
    const jrows = ((joins ?? []) as { party_id: string; user_id: string }[]).filter(
      (j) => typeof j.party_id === "string" && typeof j.user_id === "string",
    );
    // joiner 性別（male/female_count 用；secret／未知不計，沿 countGenders）。
    const genderOf = new Map<string, string | null>();
    const joinerIds = [...new Set(jrows.map((j) => j.user_id))];
    if (joinerIds.length > 0) {
      const { data: joiners } = await supabase
        .from("users")
        .select("id,gender")
        .in("id", joinerIds);
      for (const u of ((joiners ?? []) as { id: string; gender: string | null }[])) {
        genderOf.set(u.id, u.gender ?? null);
      }
    }
    for (const j of jrows) {
      joinCounts.set(j.party_id, (joinCounts.get(j.party_id) ?? 0) + 1);
      if (viewerId !== null && j.user_id === viewerId) mine.add(j.party_id);
      const arr = gendersByParty.get(j.party_id) ?? [];
      arr.push(genderOf.get(j.user_id) ?? null);
      gendersByParty.set(j.party_id, arr);
    }
    if (hostIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id,nickname,avatar_url")
        .in("id", hostIds);
      hosts = new Map(
        (((users ?? []) as unknown[]) as { id: string; nickname: string; avatar_url: string | null }[]).map(
          (u) => [u.id, { nickname: u.nickname, avatar_url: u.avatar_url }],
        ),
      );
    }
  }
  const items = list.map((r) => {
    const host = hosts.get(r.host_user_id) ?? { nickname: "酒友", avatar_url: null };
    const gc = countGenders(gendersByParty.get(r.id) ?? []);
    return {
      id: r.id,
      place: r.place,
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      start_at: r.start_at,
      expires_at: r.expires_at,
      seats_total: r.seats_total,
      seats_male: r.seats_male,
      seats_female: r.seats_female,
      min_members: r.min_members,
      bill_intent: r.bill_intent,
      joined_count: joinCounts.get(r.id) ?? 0,
      male_count: gc.male,
      female_count: gc.female,
      host: { user_id: r.host_user_id, nickname: host.nickname, avatar_url: host.avatar_url },
      joined_by_me: mine.has(r.id),
      is_mine: viewerId !== null && r.host_user_id === viewerId,
      distance_m:
        near === null
          ? null
          : Math.round(haversineMeters(near, { lat: r.lat, lng: r.lng })),
    };
  });
  return apiOk({ items });
}
