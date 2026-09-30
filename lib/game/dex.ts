/**
 * UR G1.1 圖鑑收藏狀態純函數（storage IO 留 G1.2 薄封裝，這裡只做不可變歸約）。
 *
 * 口徑見 `docs/G1_GACHA_DEX_PLAN.md` §2.2／§3.4：同一卡只收一次（`ownedIds`），
 * 重複只累計數（`dupCounts`，節流刷庫）；登錄認領＝匿名集合併入用戶集（去重天然）。
 */

export type DexState = {
  /** 已收卡鍵（去重，插入序）。 */
  ownedIds: string[];
  /** 卡鍵→累計擁有數（含首收的 1）。 */
  dupCounts: Record<string, number>;
  /** 連續重複數（餵 `drawBrand` 用，本地即可）。 */
  pityStreak: number;
  /** 末抽日期 `YYYY-MM-DD`（首抽必 NEW 用），無即 null。 */
  lastDrawDate: string | null;
};

export function emptyDex(): DexState {
  return { ownedIds: [], dupCounts: {}, pityStreak: 0, lastDrawDate: null };
}

/**
 * 登記一次抽取（`isNew` 來自 `drawBrand`）：新卡入庫＋保底清零，重複累數＋保底續；
 * 空串 id 直接退回原態（不髒數據，fail-closed）。
 */
export function registerDraw(state: DexState, cardId: string, isNew: boolean, today: string): DexState {
  if (cardId === "") return state;
  if (isNew && !state.ownedIds.includes(cardId)) {
    return {
      ownedIds: [...state.ownedIds, cardId],
      dupCounts: { ...state.dupCounts, [cardId]: 1 },
      pityStreak: 0,
      lastDrawDate: today,
    };
  }
  const prev = state.dupCounts[cardId] ?? (state.ownedIds.includes(cardId) ? 1 : 0);
  return {
    ownedIds: state.ownedIds.includes(cardId) ? state.ownedIds : [...state.ownedIds, cardId],
    dupCounts: { ...state.dupCounts, [cardId]: prev + 1 },
    pityStreak: state.pityStreak + 1,
    lastDrawDate: today,
  };
}

/**
 * 登錄認領：匿名集合併入用戶集。id 取並集（插入序：用戶先），
 * 計數相加，保底取大，日期取新（字串可比）。兩邊都不動源對象。
 */
export function mergeDex(user: DexState, anon: DexState): DexState {
  const ownedIds = [...user.ownedIds];
  for (const id of anon.ownedIds) {
    if (!ownedIds.includes(id)) ownedIds.push(id);
  }
  const dupCounts: Record<string, number> = { ...user.dupCounts };
  for (const [id, n] of Object.entries(anon.dupCounts)) {
    dupCounts[id] = (dupCounts[id] ?? 0) + n;
  }
  return {
    ownedIds,
    dupCounts,
    pityStreak: Math.max(user.pityStreak, anon.pityStreak),
    lastDrawDate:
      user.lastDrawDate === null
        ? anon.lastDrawDate
        : anon.lastDrawDate === null || anon.lastDrawDate < user.lastDrawDate
          ? user.lastDrawDate
          : anon.lastDrawDate,
  };
}
