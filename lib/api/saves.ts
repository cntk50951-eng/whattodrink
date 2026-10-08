/**
 * UR E.26 打卡收藏 toggle 回执（纯形状，幂等语义由联合主键＋route 保证）。
 * 与 like 的差异（交接有意）：只有 saved，无 save_count（收藏数是私人聚合，不新增公开面）。
 */

export type SaveToggleJson = {
  saved: boolean;
};

/** toggle 回执组装。 */
export function buildSaveJson(saved: boolean): SaveToggleJson {
  return { saved };
}
