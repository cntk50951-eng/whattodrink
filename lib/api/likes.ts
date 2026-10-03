/**
 * UR E.10 batch2 打卡点赞 toggle（纯函数层，可单测）。
 * 计数语义：实时 `count`，不存列（沿 future-schema post_likes 口径）。
 * 可见／隐身／归属语义由 route 层执行（沿 E.7 comments 口径），本层只管形状。
 */

/** 点赞回执：liked 本次动作后状态，like_count 实时总数（脏值钳零）。 */
export type LikeToggleJson = {
  liked: boolean;
  like_count: number;
};

/** DB count 转回执数（负／非数／无穷即 0，不炸包络）。 */
export function asLikeCount(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

/** toggle 回执组装（纯形状，幂等语义由唯一键＋route 保证）。 */
export function buildLikeJson(liked: boolean, count: unknown): LikeToggleJson {
  return { liked, like_count: asLikeCount(count) };
}
