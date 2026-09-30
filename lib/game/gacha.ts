/**
 * UR G1.1 扭蛋規則純函數（判定與演出分離：先算結果，動畫只是演出）。
 *
 * 慣例沿 `lib/beers.ts`（`rand` 可注入＋Fisher-Yates，不動源數組）；
 * 保底口徑見 `docs/G1_GACHA_DEX_PLAN.md` §2.2（連 5 重複必 NEW，僅缺格時生效）。
 */

import type { BeerCategory } from "../beers";

/** 保底閾值（連續重複達此數，下一抽缺格時必 NEW；寫配置，可調）。 */
export const PITY_LIMIT = 5;

export type BrandDraw = {
  /** 抽中的卡鍵（`card_id`，白名單見 G1.4 handler）。 */
  id: string;
  /** 是否新卡（收錄／保底計數用）。 */
  isNew: boolean;
  /** 本次之後的連續重複數（調用方存回，本地即可）。 */
  nextPityStreak: number;
};

/**
 * 扭蛋：大類均勻隨機。空池回 null（調用方退全域，沿 `pickRandomBeerIn` 口徑）。
 */
export function rollLane(
  lanes: readonly BeerCategory[],
  rand: () => number = Math.random,
): BeerCategory | null {
  if (lanes.length === 0) return null;
  const pick = lanes[Math.floor(rand() * lanes.length)];
  return pick ?? null;
}

/**
 * 品牌抽卡（含保底）：`pityStreak` 達標且池內有缺格即從缺格均勻抽（必 NEW）；
 * 缺格為空（本類集滿）即順延——照常全池抽，本次不強制（保底不斷，不浪費）。
 * 空池回 null。`rand` 可注入測，不動源數組。
 */
export function drawBrand(
  poolIds: readonly string[],
  ownedIds: readonly string[],
  pityStreak: number,
  rand: () => number = Math.random,
): BrandDraw | null {
  if (poolIds.length === 0) return null;
  const streak = Number.isFinite(pityStreak) && pityStreak > 0 ? Math.floor(pityStreak) : 0;
  const owned = new Set(ownedIds);
  const unseen = poolIds.filter((id) => !owned.has(id));
  if (streak >= PITY_LIMIT && unseen.length > 0) {
    const forced = unseen[Math.floor(rand() * unseen.length)] as string;
    return { id: forced, isNew: true, nextPityStreak: 0 };
  }
  const pick = poolIds[Math.floor(rand() * poolIds.length)] as string;
  const isNew = !owned.has(pick);
  return { id: pick, isNew, nextPityStreak: isNew ? 0 : streak + 1 };
}

/**
 * 是否跨日（每日首抽必 NEW 用；日期串 `YYYY-MM-DD`，無記錄即首抽）。
 * 純字串比較，時區由調用方按 HK 日界定（沿 `canCheers` 口徑）。
 */
export function isNewDay(lastDrawDate: string | null, today: string): boolean {
  if (lastDrawDate === null || lastDrawDate === "") return true;
  return lastDrawDate !== today;
}
