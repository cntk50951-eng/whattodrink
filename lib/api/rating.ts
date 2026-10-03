/**
 * UR E.12 打卡评分改他人制（纯函数层，可单测）。
 * 语义（问答＋UR 定案）：仅非作者打 1–5 整数星，可改可撤；
 * 作者只看平均（1 位小数）＋人数；旧作者自评语义（E.10）作废。
 */

export type RatingValue = 1 | 2 | 3 | 4 | 5;

/** `POST ratings {rating}`：1–5 整数收，null 撤；其余 400（小数／越界／字符串即拒）。 */
export function parseRatingBody(raw: unknown): { rating: RatingValue | null } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).rating;
  if (v === null) return { rating: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
    return { error: "rating 只要 1–5 整数或 null" };
  }
  return { rating: v as RatingValue };
}

/** 平均展示：n≥1 即“x.x 分”，无分回 null（调用方藏 pill，不写 0 分假数据）。 */
export function formatAvgRating(avg: unknown): string | null {
  if (typeof avg !== "number" || !Number.isFinite(avg) || avg < 1 || avg > 5) {
    return null;
  }
  return `${(Math.round(avg * 10) / 10).toFixed(1)} 分`;
}

/** 明细聚合：rows 即该帖全部分（service 侧已过可见门）；回均值（未舍入）＋人数。 */
export function summarizeRatings(rows: { rating?: unknown }[]): { avg: number | null; count: number } {
  const vals = rows
    .map((r) => r.rating)
    .filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5);
  if (vals.length === 0) return { avg: null, count: 0 };
  const sum = vals.reduce((a, b) => a + b, 0);
  return { avg: sum / vals.length, count: vals.length };
}
