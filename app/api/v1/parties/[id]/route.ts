import { getAuthedClient, getUserId } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";

type PartyRow = {
  id: string;
  host_user_id: string;
  place: string;
  poi_id: string | null;
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
 * UR E.23 局詳情（🌐匿名可看；iOS-0.57 联调）。
 * `GET /api/v1/parties/:id` —— 詳情＋`members[{user_id,nickname,avatar_url,gender,joined_at,is_host}]`
 * （host 行由 host_user_id 合成，joined_at 取局創建；無需 joins 行）。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const { supabase } = await getAuthedClient();
  const viewerId = await getUserId().catch(() => null);
  const { data: rowRaw, error } = await supabase
    .from("parties")
    .select(
      "id,host_user_id,place,poi_id,city,lat,lng,start_at,expires_at,seats_total,seats_male,seats_female,min_members,bill_intent,status,created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error !== null || rowRaw === null) {
    return apiError("not_found", "酒局不存在", 404);
  }
  const row = rowRaw as PartyRow;
  const { data: joins } = await supabase
    .from("joins")
    .select("user_id,joined_at")
    .eq("party_id", id)
    .order("joined_at", { ascending: true });
  const jrows = ((joins ?? []) as { user_id: string; joined_at: string }[]).filter(
    (j) => typeof j.user_id === "string",
  );
  const memberIds = [...new Set([row.host_user_id, ...jrows.map((j) => j.user_id)])];
  let profiles = new Map<string, { nickname: string; avatar_url: string | null; gender: string | null }>();
  if (memberIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,nickname,avatar_url,gender")
      .in("id", memberIds);
    profiles = new Map(
      (((users ?? []) as unknown[]) as {
        id: string;
        nickname: string;
        avatar_url: string | null;
        gender: string | null;
      }[]).map((u) => [u.id, u]),
    );
  }
  const joinedMap = new Map(jrows.map((j) => [j.user_id, j.joined_at]));
  const members = memberIds.map((uid) => {
    const p = profiles.get(uid) ?? { nickname: "酒友", avatar_url: null, gender: null };
    return {
      user_id: uid,
      nickname: p.nickname,
      avatar_url: p.avatar_url,
      gender: p.gender,
      joined_at: uid === row.host_user_id ? row.created_at : (joinedMap.get(uid) ?? row.created_at),
      is_host: uid === row.host_user_id,
    };
  });
  return apiOk({
    id: row.id,
    place: row.place,
    poi_id: row.poi_id,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    start_at: row.start_at,
    expires_at: row.expires_at,
    seats_total: row.seats_total,
    seats_male: row.seats_male,
    seats_female: row.seats_female,
    min_members: row.min_members,
    bill_intent: row.bill_intent,
    status: row.status,
    created_at: row.created_at,
    joined_count: jrows.length,
    members,
    joined_by_me: viewerId !== null && (joinedMap.has(viewerId) || row.host_user_id === viewerId),
    is_mine: viewerId !== null && row.host_user_id === viewerId,
  });
}

/**
 * UR E.23 撤局（🔒，仅 host；cancelled 后不可再参加，沿 joins 状态门）。
 * `PATCH /api/v1/parties/:id {action: "cancel"}`。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient(req);
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
  if ((raw as Record<string, unknown>).action !== "cancel") {
    return apiError("invalid_params", "action 只要 cancel", 400);
  }
  const { data: rowRaw } = await supabase
    .from("parties")
    .select("id,host_user_id,status")
    .eq("id", id)
    .maybeSingle();
  const row = rowRaw as { id: string; host_user_id: string; status: string } | null;
  if (row === null) return apiError("not_found", "酒局不存在", 404);
  if (row.host_user_id !== userId) {
    return apiError("forbidden", "只有發起人可撤局", 403);
  }
  if (row.status === "cancelled") return apiOk({ cancelled: true });
  const { error } = await supabase
    .from("parties")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "open");
  if (error !== null) {
    console.error(`[api/v1/parties] cancel error: code=${error.code} message=${error.message}`);
    return apiError("internal", "撤局失敗", 500);
  }
  return apiOk({ cancelled: true });
}
