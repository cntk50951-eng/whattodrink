/**
 * UR E.14 v2 乾杯双边（纯函数层，可单测）。
 * 语义：敬帖 `{checkin_id}`｜回敬人 `{to_user_id}` 二选一；自敬／超限由路由判。
 * 15／天按 HK 自然天计（沿 lib/cheers.ts 口径，服务端用行时间戳重算）。
 */

/** `POST /cheers`：checkin_id｜to_user_id 二选一（非空 id 形；双给／双空／异形即 400）。 */
export function parseCheersBody(raw: unknown): { checkin_id?: string; to_user_id?: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const hasCheckin = typeof r.checkin_id === "string" && r.checkin_id !== "";
  const hasTo = typeof r.to_user_id === "string" && r.to_user_id !== "";
  if (hasCheckin === hasTo) return { error: "checkin_id／to_user_id 二选一" };
  const idShape = (v: unknown): boolean =>
    typeof v === "string" && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9-]+$/.test(v);
  if (hasCheckin && !idShape(r.checkin_id)) return { error: "checkin_id 非法" };
  if (hasTo && !idShape(r.to_user_id)) return { error: "to_user_id 非法" };
  return hasCheckin
    ? { checkin_id: r.checkin_id as string }
    : { to_user_id: r.to_user_id as string };
}

/** 当日已敬数→还能敬（服务端计数直查，HK 天界沿 lib/cheers hkTodayKey 口径由调用方定）。 */
export function cheersQuota(countToday: number, limit = 15): { ok: boolean; remaining: number } {
  const safe = Number.isFinite(countToday) && countToday > 0 ? Math.floor(countToday) : 0;
  return { ok: safe < limit, remaining: Math.max(0, limit - safe) };
}
