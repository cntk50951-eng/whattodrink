/**
 * UR E.10 batch4 评分（纯函数层，可单测）。
 * 语义（问答＋UR 定案）：作者给自己这杯打 1–5 整数星，可空清除；
 * 他人只读；聚合平均以后，不伪造小数。
 */

export type RatingValue = 1 | 2 | 3 | 4 | 5;

/** `PATCH /:id {rating}`：1–5 整数收，null 清；其余 400（小数／越界／字符串即拒）。 */
export function parseRatingBody(raw: unknown): { rating: RatingValue | null } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "body 需为对象" };
  const v = (raw as Record<string, unknown>).rating;
  if (v === null) return { rating: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
    return { error: "rating 只要 1–5 整数或 null" };
  }
  return { rating: v as RatingValue };
}

/** 展示：有分即“n 分”，无分回 null（调用方藏 pill，不写 0 分假数据）。 */
export function formatRating(rating: unknown): string | null {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }
  return `${rating} 分`;
}
