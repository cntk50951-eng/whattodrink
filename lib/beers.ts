/**
 * Mock beer / drink catalog for the Random Pick feature.
 * Real data will come from Supabase + curated Hong Kong / craft selection
 * once that infrastructure is wired up (see PRODUCT_BACKLOG.md).
 *
 * Each entry has:
 *   - id: stable identifier
 *   - emoji: visual marker for the result card
 *   - name: drink name
 *   - category: free-form category for filtering / display
 *   - tagline: short marketing line (i18n in future via backend)
 */
export type Beer = {
  id: string;
  emoji: string;
  name: string;
  category: string;
  tagline: string;
};

export const BEERS: Beer[] = [
  { id: "heineken", emoji: "🍺", name: "Heineken", category: "lager", tagline: "加班過的救贖" },
  { id: "asahi", emoji: "🍻", name: "Asahi 生啤", category: "draft", tagline: "週五的快樂開場" },
  { id: "malbec-2021", emoji: "🍷", name: "Malbec 2021", category: "red wine", tagline: "一個人的儀式感" },
  { id: "yamazaki-12", emoji: "🥃", name: "山崎 12 年", category: "whisky", tagline: "值得為自己慶祝" },
  { id: "mojito", emoji: "🍹", name: "Mojito", category: "cocktail", tagline: "朋友突然約的夜晚" },
  { id: "dasai-45", emoji: "🍶", name: "獺祭 純米大吟釀 45", category: "sake", tagline: "今晚想對自己好一點" },
  { id: "ipa", emoji: "🍺", name: "本地精釀 IPA", category: "craft beer", tagline: "想試點不一樣的" },
  { id: "gin-tonic", emoji: "🍸", name: "Gin & Tonic", category: "cocktail", tagline: "簡單但有態度" },
  { id: "rose", emoji: "🥂", name: "Provence Rosé", category: "rosé", tagline: "夏天傍晚的味道" },
  { id: "tsingtao", emoji: "🍺", name: "青島啤酒", category: "lager", tagline: "配滷水一流的選擇" },
  { id: "sauvignon-blanc", emoji: "🍾", name: "Sauvignon Blanc", category: "white wine", tagline: "海鮮日的好搭檔" },
  { id: "highball", emoji: "🥃", name: "角嗨 Highball", category: "highball", tagline: "清爽不烈的開胃" },
  { id: "stout", emoji: "🍺", name: "Guinness 健力士", category: "stout", tagline: "深夜慢飲的首選" },
  { id: "plum-wine", emoji: "🍶", name: "梅酒 on the rocks", category: "liqueur", tagline: "想念家的味道" },
  { id: "espresso-martini", emoji: "🍸", name: "Espresso Martini", category: "cocktail", tagline: "需要撐到最後一秒" },
];

/**
 * Picks one beer at random. Pure function — easy to unit test once vitest lands.
 * Caller is responsible for any async wrapping / timeout handling.
 */
export function pickRandomBeer(): Beer {
  const idx = Math.floor(Math.random() * BEERS.length);
  return BEERS[idx];
}

/* ---- UR3.8 品種分層 ----
 * L1 精簡大類＋到 BEERS.category 的映射。映射住在這裡（單源），面板只讀它：
 * 新增品牌／新 category 時補 match 行即可，L1／L2／隱性補全自然生效。
 * 每個 BEERS.category 必須恰好屬於一個大類（beers.test.ts 鎖死無孤兒、無重疊）。 */

export type BeerCategory = {
  /** Stable lane id. */
  id: string;
  /** Lane glyph for the L1 grid. */
  emoji: string;
  /** i18n key for the lane name (e.g. "catBeer"). */
  labelKey: string;
  /** BEERS.category values that belong to this lane. */
  match: readonly string[];
};

export const BEER_CATEGORIES: readonly BeerCategory[] = [
  { id: "beer", emoji: "🍺", labelKey: "catBeer", match: ["lager", "draft", "craft beer", "stout"] },
  { id: "red", emoji: "🍷", labelKey: "catRed", match: ["red wine"] },
  { id: "white", emoji: "🥂", labelKey: "catWhite", match: ["white wine", "rosé"] },
  { id: "whisky", emoji: "🥃", labelKey: "catWhisky", match: ["whisky", "highball"] },
  { id: "sake", emoji: "🍶", labelKey: "catSake", match: ["sake"] },
  { id: "cocktail", emoji: "🍸", labelKey: "catCocktail", match: ["cocktail"] },
  { id: "liqueur", emoji: "🍹", labelKey: "catLiqueur", match: ["liqueur"] },
];

/** All beers in a lane. Unknown lane id → [] (caller falls back to global pick). */
export function beersInCategory(categoryId: string): Beer[] {
  const lane = BEER_CATEGORIES.find((c) => c.id === categoryId);
  if (lane === undefined) return [];
  return BEERS.filter((b) => lane.match.includes(b.category));
}

/** The lane a beer belongs to. Unmapped category → null (never throw). */
export function categoryOfBeer(beer: Beer): BeerCategory | null {
  return (
    BEER_CATEGORIES.find((c) => c.match.includes(beer.category)) ?? null
  );
}

/**
 * Random pick constrained to one lane. `rand` is injectable for tests.
 * Unknown lane → null so the caller can fall back to pickRandomBeer().
 */
export function pickRandomBeerIn(
  categoryId: string,
  rand: () => number = Math.random,
): Beer | null {
  const pool = beersInCategory(categoryId);
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(rand() * pool.length)] as Beer | undefined;
  return pick ?? null;
}

/**
 * Shared shuffle-take core (Fisher-Yates). Never mutates the source array.
 * `rand` is injectable for tests.
 */
export function shuffleTake(
  pool: readonly Beer[],
  count: number,
  rand: () => number = Math.random,
): Beer[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i] as Beer;
    copy[i] = copy[j] as Beer;
    copy[j] = tmp;
  }
  const n = Math.min(Math.max(0, count), copy.length);
  return copy.slice(0, n);
}

/**
 * UR3.9 batch — shuffle within a lane and take `count`. Unknown lane
 * falls back to the global pool. Never mutates the source array.
 * `rand` is injectable for tests (Fisher-Yates).
 */
export function pickRandomBatch(
  categoryId: string,
  count: number = 6,
  rand: () => number = Math.random,
): Beer[] {
  const lanePool = beersInCategory(categoryId);
  const source = lanePool.length > 0 ? lanePool : BEERS;
  return shuffleTake(source, count, rand);
}

/**
 * UR3.9 v4 collage rhythm — card size follows lane depth (designer review:
 * uniform grids read as mechanical). Big lanes invite browsing, small ones
 * stay quiet. Thresholds locked by test (current max is 5).
 */
export type LaneCardSize = "lg" | "md" | "sm";

export function laneCardSize(memberCount: number): LaneCardSize {
  if (memberCount >= 4) return "lg";
  if (memberCount >= 2) return "md";
  return "sm";
}

/**
 * UR3.9 v2 own-record swap batch — same lane as the current beer, current
 * excluded. Single-item lane falls back to global-minus-current (never empty
 * while the catalog has >1 beer, never loops forever).
 */
export function pickSwapBatch(
  current: Beer,
  count: number = 6,
  rand: () => number = Math.random,
): Beer[] {
  const lane = categoryOfBeer(current);
  const pool = (lane !== null ? beersInCategory(lane.id) : BEERS).filter(
    (b) => b.id !== current.id,
  );
  const source =
    pool.length > 0 ? pool : BEERS.filter((b) => b.id !== current.id);
  return shuffleTake(source, count, rand);
}