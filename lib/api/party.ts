/**
 * UR E.23 公開攢局（纯函数层，可单测）。
 * 名额模型：seats_male／seats_female 专用席，余量＝总量－两者＝开放席；
 * secret 性别只占开放席（问答定案）；host 占一席（不分性别，走开放语义——
 * host 性别若对的上专用席则优先专用，否则开放；实现为纯计数，调用方按序落位）。
 */

export type BillIntent = "host" | "aa" | "flexible";

export type PartyInput = {
  place: string;
  poi_id?: string;
  city: string;
  lat: number;
  lng: number;
  start_at: string;
  seats_total: number;
  seats_male: number;
  seats_female: number;
  min_members: number;
  bill_intent: BillIntent;
};

/** `POST /parties` body 校验（WGS-84 由客户端转好；`start_at` 未来 14 天内）。 */
export function parsePartyBody(raw: unknown, nowMs: number = Date.now()): { body: PartyInput } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const place = typeof r.place === "string" ? r.place.trim() : "";
  if (place === "" || place.length > 30) return { error: "place 只要 1–30 字" };
  const poi = r.poi_id;
  if (poi !== undefined && poi !== null) {
    if (typeof poi !== "string" || poi === "" || poi.length > 64 || !/^[A-Za-z0-9-_]+$/.test(poi)) {
      return { error: "poi_id 非法（≤64，字母数字-_）" };
    }
  }
  const city = typeof r.city === "string" ? r.city.trim().slice(0, 30) : "";
  const lat = r.lat;
  const lng = r.lng;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: "lat 非法" };
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { error: "lng 非法" };
  }
  if (typeof r.start_at !== "string") return { error: "start_at 必填" };
  const start = Date.parse(r.start_at);
  if (!Number.isFinite(start) || start <= nowMs || start > nowMs + 14 * 24 * 3600_000) {
    return { error: "start_at 須未来 14 天内" };
  }
  const int = (v: unknown): number | null =>
    typeof v === "number" && Number.isInteger(v) ? v : null;
  const total = int(r.seats_total);
  const male = int(r.seats_male) ?? 0;
  const female = int(r.seats_female) ?? 0;
  const min = int(r.min_members) ?? 2;
  if (total === null || total < 2 || total > 12) return { error: "seats_total 只要 2–12" };
  if (male < 0 || female < 0 || male + female > total) {
    return { error: "男女名额须 ≥0 且和≤总量" };
  }
  if (min < 2 || min > total) return { error: "min_members 须 2..总量" };
  if (r.bill_intent !== "host" && r.bill_intent !== "aa" && r.bill_intent !== "flexible") {
    return { error: "bill_intent 必填（host｜aa｜flexible）" };
  }
  return {
    body: {
      place,
      ...(typeof poi === "string" ? { poi_id: poi } : {}),
      city,
      lat,
      lng,
      start_at: new Date(start).toISOString(),
      seats_total: total,
      seats_male: male,
      seats_female: female,
      min_members: min,
      bill_intent: r.bill_intent,
    },
  };
}

/** 到期＝开始＋3h（散席宽限，问答定案；iOS-0.57 待回）。 */
export function partyExpiresAt(startAtMs: number): number {
  return startAtMs + 3 * 3600_000;
}

/** HK 今日 0 点 UTC ISO（发起 3／天窗口下界，沿 cheers 口径）。 */
export function hkDayStartISO(nowMs: number): string {
  const hk = new Date(nowMs + 8 * 3600_000);
  hk.setUTCHours(0, 0, 0, 0);
  return new Date(hk.getTime() - 8 * 3600_000).toISOString();
}

/** 名额判定（纯计数；调用方先查 joins＋joiner 性别）。
 * male／female 优先本性别专用席，满则开放席；secret／未知只走开放席。
 * 回 ok｜full（总数满）｜gender_full（本路满，含 secret 无开放席）。
 */
export function seatFor(
  gender: "male" | "female" | "secret" | null,
  counts: { total: number; male: number; female: number },
  seats: { total: number; male: number; female: number },
): { ok: true } | { ok: false; code: "party_full" | "gender_full" } {
  const used = counts.total;
  if (used >= seats.total) return { ok: false, code: "party_full" };
  // 开放席容量与已占（专用席未占满不挤占，只算落定部分）。
  const openTotal = seats.total - seats.male - seats.female;
  const openUsed = used - Math.min(counts.male, seats.male) - Math.min(counts.female, seats.female);
  if (gender === "male" && counts.male < seats.male) return { ok: true };
  if (gender === "female" && counts.female < seats.female) return { ok: true };
  if (openUsed < openTotal) return { ok: true };
  return { ok: false, code: "gender_full" };
}

/** joins 性别计数（列表 male/female_count 用；secret／未知不计入男女，只占开放席）。 */
export function countGenders(genders: (string | null)[]): { male: number; female: number } {
  let male = 0;
  let female = 0;
  for (const g of genders) {
    if (g === "male") male += 1;
    else if (g === "female") female += 1;
  }
  return { male, female };
}

/** 席位进度（0–1 钳制；进度条用，沿 iOS partyProgress）。 */
export function partyProgress(joined: number, total: number): number {
  if (!Number.isFinite(joined) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, joined / total));
}

/** 构成文案（"3男2女"；零值省略段，沿 iOS partyMixText）。 */
export function partyMixText(male: number, female: number): string {
  const parts: string[] = [];
  if (male > 0) parts.push(`${male}男`);
  if (female > 0) parts.push(`${female}女`);
  return parts.join(" ");
}

/** 性别余量文案（"還差1男2女"；無配額／已滿回 null，沿 iOS partyRemainText）。 */
export function partyRemainText(
  seatsMale: number,
  seatsFemale: number,
  maleCount: number,
  femaleCount: number,
): string | null {
  if (seatsMale <= 0 && seatsFemale <= 0) return null;
  const parts: string[] = [];
  const rm = seatsMale - maleCount;
  const rf = seatsFemale - femaleCount;
  if (rm > 0) parts.push(`還差${rm}男`);
  if (rf > 0) parts.push(`還差${rf}女`);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** 混合行（构成＋余量；無余量沿舊構成，沿 iOS partyMixLine）。 */
export function partyMixLine(
  maleCount: number,
  femaleCount: number,
  seatsMale: number,
  seatsFemale: number,
): string {
  const base = partyMixText(maleCount, femaleCount);
  const r = partyRemainText(seatsMale, seatsFemale, maleCount, femaleCount);
  if (r === null) return base;
  return base === "" ? r : `${base} · ${r}`;
}

export type PartyJoinState = "host" | "joined" | "joinable" | "full" | "cancelled";

/** 参加位判定（cancelled 优先终态；isMine 优先 host；joined 次之；满员锁，沿 iOS）。 */
export function partyJoinState(
  status: string,
  isMine: boolean,
  joinedByMe: boolean,
  joinedCount: number,
  seatsTotal: number,
): PartyJoinState {
  if (status === "cancelled") return "cancelled";
  if (isMine) return "host";
  if (joinedByMe) return "joined";
  if (joinedCount >= seatsTotal) return "full";
  return "joinable";
}

/** 发局时段（now 即时／half＋30分／tonight 当天香港 21:00 过即次日／custom 直给，沿 iOS）。 */
export type PartySlot = "now" | "half" | "tonight" | "custom";

export function partySlotStartAt(
  slot: PartySlot,
  customMs: number,
  nowMs: number,
): number {
  if (slot === "now") return nowMs;
  if (slot === "half") return nowMs + 30 * 60_000;
  if (slot === "custom") return customMs;
  // tonight：当天 Asia/Hong_Kong 21:00，过了即次日（不用 Intl，纯算避 locale 坑）。
  const hk = nowMs + 8 * 3600_000;
  const day = Math.floor(hk / 86_400_000);
  const t = day * 86_400_000 + 21 * 3600_000 - 8 * 3600_000;
  return t <= nowMs ? t + 86_400_000 : t;
}

/** mine 档 PostgREST `or` 条件（我发起＋我参加；空参加即只查发起，避免 `in.()` 空集语法错）。 */
export function mineOrCondition(userId: string, joinedIds: string[]): string {
  const parts = [`host_user_id.eq.${userId}`];
  const ids = [...new Set(joinedIds.filter((id) => typeof id === "string" && id !== ""))];
  if (ids.length > 0) parts.push(`id.in.(${ids.join(",")})`);
  return parts.join(",");
}
