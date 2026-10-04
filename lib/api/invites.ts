/**
 * UR E.16 約喝酒邀請（纯函数层，可单测）。
 * 时段三档：now（即时，2h 窗）｜half（30 分钟后，2h 窗）｜tonight（今晚 21:00，
 * 过了 21:00 即次日 21:00；3h 窗）。过期由 expires_at 表达，服务端读时判。
 */

export type InviteSlot = "now" | "half" | "tonight";

/** `POST /invites {to_user_id}｜{checkin_id}＋{place, slot}`：對象二選一（server 解作者，沿加好友口徑）＋店 1–30 字＋三選一時段。 */
export function parseInviteBody(raw: unknown): { to_user_id?: string; checkin_id?: string; place: string; slot: InviteSlot } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  const to = r.to_user_id;
  const ci = r.checkin_id;
  const hasTo = typeof to === "string" && to !== "";
  const hasCi = typeof ci === "string" && ci !== "";
  if (hasTo === hasCi) return { error: "to_user_id／checkin_id 二选一" };
  const idShape = (v: unknown): boolean =>
    typeof v === "string" && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9-]+$/.test(v as string);
  if (hasTo && !idShape(to)) return { error: "to_user_id 非法" };
  if (hasCi && !idShape(ci)) return { error: "checkin_id 非法" };
  const place = typeof r.place === "string" ? r.place.trim() : "";
  if (place === "" || place.length > 30) return { error: "place 只要 1–30 字（公共场所）" };
  if (r.slot !== "now" && r.slot !== "half" && r.slot !== "tonight") {
    return { error: "slot 只要 now｜half｜tonight" };
  }
  return {
    ...(hasTo ? { to_user_id: to as string } : { checkin_id: ci as string }),
    place,
    slot: r.slot,
  };
}

/** 时段→（开始，过期）epoch ms（纯时间算，不读库，可单测注入 now）。 */
export function inviteWindow(slot: InviteSlot, nowMs: number): { startAt: number; expiresAt: number } {
  const H = 3600_000;
  if (slot === "now") return { startAt: nowMs, expiresAt: nowMs + 2 * H };
  if (slot === "half") return { startAt: nowMs + 30 * 60_000, expiresAt: nowMs + 30 * 60_000 + 2 * H };
  // tonight：今天 21:00（HK），过了即明天 21:00；3h 窗。
  const hk = new Date(nowMs + 8 * H);
  const day = new Date(Date.UTC(hk.getUTCFullYear(), hk.getUTCMonth(), hk.getUTCDate(), 21, 0, 0, 0) - 8 * H);
  let start = day.getTime();
  if (start <= nowMs) start += 24 * H;
  return { startAt: start, expiresAt: start + 3 * H };
}

/** 展示态（发送方视角）：终态直译；sent 看过期（过即未成局）＋24h 未回应。 */
export function inviteDisplay(
  status: string,
  expiresAt: number | null,
  createdAt: number,
  nowMs: number,
): "waiting" | "noReply" | "over" | "accepted" | "recalled" | "declined" {
  if (status === "accepted") return "accepted";
  if (status === "recalled") return "recalled";
  if (status === "declined") return "declined";
  if (expiresAt !== null && Number.isFinite(expiresAt) && nowMs > expiresAt) return "over";
  if (nowMs - createdAt > 24 * 3600_000) return "noReply";
  return "waiting";
}
