import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { PARTY_CANCEL_CUTOFF_MIN, minutesBeforeStart, seatFor } from "@/lib/api/party";
import { writeTrustEvent } from "@/lib/trust/ledger";
import { STEALTH_SELF_BLOCK_MSG } from "@/lib/mode";

type PartyRow = {
  id: string;
  host_user_id: string;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  status: string;
  expires_at: string;
};

/**
 * UR E.23 参加（🔒，匿名 401；隐身／未成年 403；iOS-0.57 联调）。
 * `POST /api/v1/parties/:id/joins` —— 事務內判满（总数／性别分开
 * `409 party_full/gender_full`，沿 seatFor 口径；secret 只占开放席）；
 * 已参加幂等 200；过期 410；cancelled 局 410。
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient();
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const { data: partyRaw } = await supabase
    .from("parties")
    .select("id,host_user_id,seats_total,seats_male,seats_female,status,expires_at")
    .eq("id", id)
    .maybeSingle();
  const party = partyRaw as PartyRow | null;
  if (party === null) return apiError("not_found", "酒局不存在", 404);
  if (party.status !== "open") {
    return apiError("invalid_params", "酒局已撤銷", 410);
  }
  if (Date.parse(party.expires_at) < Date.now()) {
    return apiError("invalid_params", "酒局已過期", 410);
  }
  const { data: meRow } = await supabase
    .from("users")
    .select("mode,gender,dob")
    .eq("id", userId)
    .maybeSingle();
  const me = (meRow ?? {}) as { mode?: unknown; gender?: unknown; dob?: unknown };
  if (me.mode === "stealth") {
    return apiError("forbidden", STEALTH_SELF_BLOCK_MSG, 403);
  }
  if (isMinorDob(me.dob, Date.now())) {
    return apiError("forbidden", "未滿 18 歲不可參加", 403);
  }
  const gender: "male" | "female" | "secret" | null =
    me.gender === "male" || me.gender === "female" ? me.gender : "secret";
  // 已参加幂等（并发撞唯一键收敛同值，沿 like 口径）。
  const { data: existed } = await supabase
    .from("joins")
    .select("id")
    .eq("party_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existed !== null) {
    return apiOk({ joined: true });
  }
  // 投訴過這個酒局（沒撤回）就不能再加入：酒局有效期內不該讓投訴人回到被投訴的局裡
  // （上面已擋掉撤銷／過期的局，所以「有效期間」天然成立；被投訴人與其他人不受影響）。
  // complaints 表 RLS 無讀策略（只給服務端讀），所以必須走 service client，否則永遠查不到。
  const svcForComplaint = await createServiceClient();
  const { data: myComplaint } = await svcForComplaint
    .from("complaints")
    .select("id")
    .eq("party_id", id)
    .eq("filer_id", userId)
    .neq("status", "withdrawn")
    .limit(1);
  if (Array.isArray(myComplaint) && myComplaint.length > 0) {
    return apiError("forbidden", "你已投訴過這個酒局，酒局有效期間不能再加入", 403);
  }
  // 名额判定（读 joins＋joiner 性别；并发超卖由唯一键＋重查收敛，见下）。
  const { data: joins } = await supabase
    .from("joins")
    .select("user_id")
    .eq("party_id", id);
  const jrows = ((joins ?? []) as { user_id: string }[]).filter(
    (j) => typeof j.user_id === "string",
  );
  const genders = new Map<string, string>();
  if (jrows.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id,gender")
      .in(
        "id",
        jrows.map((j) => j.user_id),
      );
    for (const u of ((users ?? []) as { id: string; gender: string | null }[])) {
      genders.set(u.id, u.gender ?? "secret");
    }
  }
  let male = 0;
  let female = 0;
  for (const j of jrows) {
    const g = genders.get(j.user_id);
    if (g === "male") male += 1;
    else if (g === "female") female += 1;
  }
  const seat = seatFor(gender, { total: jrows.length, male, female }, {
    total: party.seats_total,
    male: party.seats_male,
    female: party.seats_female,
  });
  if (!seat.ok) {
    return apiError(
      seat.code,
      seat.code === "party_full" ? "名額已滿" : "該性別名額已滿",
      409,
    );
  }
  const { error: iErr } = await supabase.from("joins").insert({
    party_id: id,
    user_id: userId,
  });
  if (iErr !== null) {
    // 23505 并发撞键：对方先落位→收敛为已参加。
    if (iErr.code !== "23505") {
      console.error(`[api/v1/parties/joins] insert error: code=${iErr.code} message=${iErr.message}`);
      return apiError("internal", "參加失敗", 500);
    }
  }
  return apiOk({ joined: true });
}

/**
 * UR E.23 退席（🔒；阶段 A：先记事件再删行，通知 host）。
 * `DELETE /api/v1/parties/:id/joins` —— 无行也 200（幂等，不记事件）；
 * 过期 410；回 `{left, minutes_before_start（可负）, late（<60min）}`。
 * 已开局后退出记 `leave_after_start`，不发 late 通知（中途离席）。
 * 写走 service（事件＋通知表零 policy；join 删沿旧 RLS）。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { supabase, userId } = await getAuthedClient();
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const { id } = await params;
  if (typeof id !== "string" || id === "" || id.length > 64) {
    return apiError("invalid_params", "id 非法", 400);
  }
  const { data: partyRaw } = await supabase
    .from("parties")
    .select("id,expires_at,status,start_at,host_user_id,place")
    .eq("id", id)
    .maybeSingle();
  const party = partyRaw as {
    id: string;
    expires_at: string;
    status: string;
    start_at: string;
    host_user_id: string;
    place: string;
  } | null;
  if (party === null) return apiError("not_found", "酒局不存在", 404);
  const nowMs = Date.now();
  if (Date.parse(party.expires_at) < nowMs) {
    return apiError("invalid_params", "酒局已過期", 410);
  }
  const svc = await createServiceClient();
  const { data: myJoin } = await svc
    .from("joins")
    .select("user_id")
    .eq("party_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  const startMs = Date.parse(party.start_at);
  const minutes = minutesBeforeStart(startMs, nowMs);
  const late = minutes < PARTY_CANCEL_CUTOFF_MIN;
  if (myJoin === null) {
    return apiOk({ left: true, minutes_before_start: minutes, late });
  }
  const afterStart = Number.isFinite(startMs) && nowMs >= startMs;
  const kind = afterStart ? "leave_after_start" : late ? "leave_late" : "leave";
  const { count: joiners } = await svc
    .from("joins")
    .select("user_id", { count: "exact", head: true })
    .eq("party_id", id);
  await svc.from("party_events").insert({
    party_id: id,
    user_id: userId,
    kind,
    joiners_count: joiners ?? 0,
    minutes_before_start: minutes,
  });
  await supabase.from("joins").delete().eq("party_id", id).eq("user_id", userId);
  // E.30 诚信记账（开局后离席／≥24h 不记；幂等 ref 防重）。
  if (!afterStart && minutes < 24 * 60) {
    const leaveKind = minutes < 60 ? "leave_late" : minutes < 3 * 60 ? "leave_3h_1h" : "leave_24h_3h";
    const leaveDelta = minutes < 60 ? -6 : minutes < 3 * 60 ? -3 : -1;
    await writeTrustEvent(
      svc,
      {
        user_id: userId,
        kind: leaveKind,
        delta: leaveDelta,
        party_id: id,
        ref_id: `party:${id}:leave:${userId}`,
        expires_days: 90,
      },
      nowMs,
    );
  }
  // 通知 host（中途离席不发；host 自己退不发；拉黑关系不发，不泄存在）。
  if (!afterStart && party.host_user_id !== userId) {
    const { data: blockRows } = await svc
      .from("cheers_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${party.host_user_id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${party.host_user_id})`)
      .limit(1);
    if (!Array.isArray(blockRows) || blockRows.length === 0) {
      const { data: nickRow } = await svc.from("users").select("nickname").eq("id", userId).maybeSingle();
      const nick =
        typeof (nickRow as { nickname?: unknown } | null)?.nickname === "string" &&
        ((nickRow as { nickname?: string }).nickname ?? "") !== ""
          ? (nickRow as { nickname: string }).nickname
          : "酒友";
      await svc.from("notifications").insert({
        user_id: party.host_user_id,
        kind: late ? "member_left_late" : "member_left",
        party_id: id,
        actor_id: userId,
        payload: {
          party_place: party.place,
          start_at: party.start_at,
          actor_nickname: nick,
          minutes_before_start: minutes,
        },
      });
    }
  }
  return apiOk({ left: true, minutes_before_start: minutes, late });
}
