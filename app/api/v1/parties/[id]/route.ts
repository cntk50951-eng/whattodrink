import { createServiceClient, getAuthedClient, getUserId } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { cancelPolicy, leavePolicy, minutesBeforeStart } from "@/lib/api/party";
import { hostTrustMap } from "@/lib/trust/ledger";
import { writeTrustEvent } from "@/lib/trust/ledger";

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
  purposes: string[];
  purpose_other: string | null;
  host_intro: string | null;
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
      "id,host_user_id,place,poi_id,city,lat,lng,start_at,expires_at,seats_total,seats_male,seats_female,min_members,bill_intent,purposes,purpose_other,host_intro,status,created_at",
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
  const joinedByMe = viewerId !== null && (joinedMap.has(viewerId) || row.host_user_id === viewerId);
  const nowMs = Date.now();
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
  // E.30 发起人信用徽章（与列表同形；service 读）。
  const detailTrust = await hostTrustMap(await createServiceClient(), [row.host_user_id], nowMs);
  // 我是否已到场打卡（只对登录者；party_attendance 走 service）
  let myArrived = false;
  if (viewerId !== null) {
    const { data: att } = await (await createServiceClient())
      .from("party_attendance")
      .select("arrived_at")
      .eq("party_id", row.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    myArrived = typeof (att as { arrived_at?: unknown } | null)?.arrived_at === "string";
  }
  const hostMember = members.find((m) => m.is_host) ?? { user_id: row.host_user_id, nickname: "酒友", avatar_url: null };
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
    purposes: Array.isArray(row.purposes) ? row.purposes.filter((p): p is string => typeof p === "string") : [],
    // 匿名只回 purposes（同列表口径）。
    ...(viewerId !== null
      ? {
          purpose_other: typeof row.purpose_other === "string" ? row.purpose_other : null,
          host_intro: typeof row.host_intro === "string" ? row.host_intro : null,
        }
      : {}),
    status: row.status,
    created_at: row.created_at,
    joined_count: jrows.length,
    members,
    host: {
      user_id: hostMember.user_id,
      nickname: hostMember.nickname,
      avatar_url: hostMember.avatar_url,
      trust: detailTrust.get(row.host_user_id) ?? { tier: "newbie", hosted_count: 0, completion_rate: null, cancel_90d: 0 },
    },
    joined_by_me: joinedByMe,
    is_mine: viewerId !== null && row.host_user_id === viewerId,
    // 阶段 A 政策欄（匿名缺席）。
    ...(viewerId !== null
      ? {
          my_arrived: myArrived,
          cancel_policy: cancelPolicy({
            isHost: row.host_user_id === viewerId,
            status: row.status,
            startAtMs: Date.parse(row.start_at),
            joinersCount: jrows.length,
            nowMs,
          }),
          ...(joinedByMe
            ? { leave_policy: leavePolicy({ joined: true, startAtMs: Date.parse(row.start_at), nowMs }) }
            : {}),
        }
      : {}),
  });
}

/**
 * UR E.23 撤局（🔒，仅 host；阶段 A 规则）。
 * `PATCH /api/v1/parties/:id {action: "cancel"}` —— 距开局 <60min／已开局 409
 * `too_close_to_start`；无人报名随时可撤（`cancel_no_joiners`，不通知）；
 * 有人时记事件＋通知全部在场者；`cancelled_at` 落库；重复撤幂等
 * `{cancelled:true, notified_count:0}`。写走 service（事件＋通知表零 policy）。
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
    .select("id,host_user_id,status,start_at,place")
    .eq("id", id)
    .maybeSingle();
  const row = rowRaw as {
    id: string;
    host_user_id: string;
    status: string;
    start_at: string;
    place: string;
  } | null;
  if (row === null) return apiError("not_found", "酒局不存在", 404);
  if (row.host_user_id !== userId) {
    return apiError("forbidden", "只有發起人可撤局", 403);
  }
  if (row.status === "cancelled") return apiOk({ cancelled: true, notified_count: 0 });
  const svc = await createServiceClient();
  const nowMs = Date.now();
  const { data: joinRows } = await svc
    .from("joins")
    .select("user_id")
    .eq("party_id", id);
  const joinerIds = [
    ...new Set(
      ((joinRows ?? []) as { user_id?: unknown }[])
        .map((j) => j.user_id)
        .filter((v): v is string => typeof v === "string" && v !== ""),
    ),
  ];
  const policy = cancelPolicy({
    isHost: true,
    status: row.status,
    startAtMs: Date.parse(row.start_at),
    joinersCount: joinerIds.length,
    nowMs,
  });
  if (!policy.can_cancel) {
    // 阶段 A 无紧急通道：<1h 与已开局一律拒绝（message 照交接，iOS 原文显示）。
    return apiError("too_close_to_start", "臨近開局不可撤銷", 409);
  }
  const nowIso = new Date(nowMs).toISOString();
  const { error } = await svc
    .from("parties")
    .update({ status: "cancelled", cancelled_at: nowIso })
    .eq("id", id)
    .eq("status", "open");
  if (error !== null) {
    console.error(`[api/v1/parties] cancel error: code=${error.code} message=${error.message}`);
    return apiError("internal", "撤局失敗", 500);
  }
  if (joinerIds.length === 0) {
    await svc.from("party_events").insert({
      party_id: id,
      user_id: userId,
      kind: "cancel_no_joiners",
      joiners_count: 0,
      minutes_before_start: minutesBeforeStart(Date.parse(row.start_at), nowMs),
    });
    return apiOk({ cancelled: true, notified_count: 0 });
  }
  await svc.from("party_events").insert({
    party_id: id,
    user_id: userId,
    kind: "cancel",
    joiners_count: joinerIds.length,
    minutes_before_start: minutesBeforeStart(Date.parse(row.start_at), nowMs),
  });
  // E.30 诚信记账（有人报名才记；≥24h 不记；幂等 ref 防重）。
  const cancelMinutes = minutesBeforeStart(Date.parse(row.start_at), nowMs);
  if (cancelMinutes < 24 * 60) {
    await writeTrustEvent(
      svc,
      {
        user_id: userId,
        kind: cancelMinutes < 3 * 60 ? "cancel_3h_1h" : "cancel_24h_3h",
        delta: cancelMinutes < 3 * 60 ? -6 : -3,
        party_id: id,
        ref_id: `party:${id}:cancel:${userId}`,
        expires_days: 90,
      },
      nowMs,
    );
  }
  // 通知全部在场者（撤銷前已退的不在 joins 里，自然不发；iOS 直接拼文案）。
  const { data: hostRow } = await svc.from("users").select("nickname").eq("id", userId).maybeSingle();
  const hostNick =
    typeof (hostRow as { nickname?: unknown } | null)?.nickname === "string" &&
    ((hostRow as { nickname?: string }).nickname ?? "") !== ""
      ? (hostRow as { nickname: string }).nickname
      : "酒友";
  const { error: nErr } = await svc.from("notifications").insert(
    joinerIds.map((uid) => ({
      user_id: uid,
      kind: "party_cancelled",
      party_id: id,
      actor_id: userId,
      payload: { party_place: row.place, start_at: row.start_at, actor_nickname: hostNick },
    })),
  );
  if (nErr !== null) {
    console.error(`[api/v1/parties] notify error: code=${nErr.code} message=${nErr.message}`);
  }
  return apiOk({ cancelled: true, notified_count: joinerIds.length });
}
