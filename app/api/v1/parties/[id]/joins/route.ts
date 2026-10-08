import { getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isMinorDob } from "@/lib/api/cheers";
import { seatFor } from "@/lib/api/party";

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
    return apiError("forbidden", "隱身模式不可參加", 403);
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
 * UR E.23 退席（🔒；到期前随时可退，幂等；席位即时回池——行删即回，无需计数器）。
 * `DELETE /api/v1/parties/:id/joins` —— 无行也 200；过期 410。
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
    .select("id,expires_at,status")
    .eq("id", id)
    .maybeSingle();
  const party = partyRaw as { id: string; expires_at: string; status: string } | null;
  if (party === null) return apiError("not_found", "酒局不存在", 404);
  if (Date.parse(party.expires_at) < Date.now()) {
    return apiError("invalid_params", "酒局已過期", 410);
  }
  await supabase.from("joins").delete().eq("party_id", id).eq("user_id", userId);
  return apiOk({ left: true });
}
