/**
 * UR E.10 batch3 “我也想喝”计数 toggle（纯函数层，可单测）。
 * 语义（问答定案：仅计数）：每人每帖一行，PK 去重；计数实时，不进推荐（反哺另议）。
 * 可见／隐身／归属语义由 route 层执行（沿 batch2 like 口径），本层只管形状。
 */

/** 想喝回执：wanted 本次动作后状态，want_count 实时总数（脏值钳零）。 */
export type WantToggleJson = {
  wanted: boolean;
  want_count: number;
};

/** DB count 转回执数（负／非数／无穷即 0，不炸包络）。 */
export function asWantCount(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

/** toggle 回执组装（纯形状，幂等语义由双列 PK＋route 保证）。 */
export function buildWantJson(wanted: boolean, count: unknown): WantToggleJson {
  return { wanted, want_count: asWantCount(count) };
}
