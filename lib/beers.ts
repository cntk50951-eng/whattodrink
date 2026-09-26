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
import { toBeersJson } from "./api/beers";
export type Beer = {
  id: string;
  emoji: string;
  name: string;
  category: string;
  tagline: string;
  /** 自畫圖標公開 URL（UR A.4：API 回填；缺席＝還沒畫圖，走 emoji）。 */
  icon_url?: string | null;
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
  /* ---- UR A.20 已畫品牌全收編（id／emoji／name／category 沿 seed，tagline 港味短句；
   * 未來 seed 行沿用同 id＋名，API 換源即原地覆蓋。Moutai 未進 DB，靜態保底覆蓋。） */
  { id: "corona-extra", emoji: "🍺", name: "Corona Extra", category: "lager", tagline: "加青檸先係靈魂" },
  { id: "blue-girl", emoji: "🍺", name: "Blue Girl", category: "lager", tagline: "大排檔標配" },
  { id: "hoegaarden", emoji: "🍺", name: "Hoegaarden", category: "lager", tagline: "六角杯，白啤代表" },
  { id: "kirin-ichiban", emoji: "🍺", name: "Kirin Ichiban", category: "lager", tagline: "一番搾，飲得出" },
  { id: "yebisu", emoji: "🍺", name: "Yebisu", category: "lager", tagline: "惠比壽的金罐" },
  { id: "young-master", emoji: "🍺", name: "Young Master", category: "craft beer", tagline: "少爺，本地薑" },
  { id: "moutai-flying-fairy", emoji: "🥃", name: "茅台飛天", category: "spirits", tagline: "飛天，敬重要的人" },
  { id: "budweiser", emoji: "🍺", name: "Budweiser", category: "lager", tagline: "紅白藍的經典" },
  { id: "carlsberg", emoji: "🍺", name: "Carlsberg", category: "lager", tagline: "綠罐老朋友" },
  { id: "sapporo", emoji: "🍺", name: "Sapporo", category: "lager", tagline: "星星罐，配拉麵" },
  { id: "snow", emoji: "🍺", name: "Snow", category: "lager", tagline: "雪花，勇闖天涯" },
  { id: "yanjing", emoji: "🍺", name: "Yanjing", category: "lager", tagline: "燕京，京味十足" },
  { id: "harbin", emoji: "🍺", name: "Harbin", category: "lager", tagline: "哈啤，東北味" },
  { id: "bud-light", emoji: "🍺", name: "Bud Light", category: "lager", tagline: "淡字輩，清爽派" },
  { id: "coors-light", emoji: "🍺", name: "Coors Light", category: "lager", tagline: "雪山水釀的淡啤" },
  { id: "miller-lite", emoji: "🍺", name: "Miller Lite", category: "lager", tagline: "米勒，淡啤鼻祖" },
  { id: "modelo-especial", emoji: "🍺", name: "Modelo Especial", category: "lager", tagline: "墨西哥金罐" },
  { id: "negra-modelo", emoji: "🍺", name: "Negra Modelo", category: "lager", tagline: "黑啤，濃一點" },
  { id: "pacifico", emoji: "🍺", name: "Pacifico", category: "lager", tagline: "衝浪後的太平洋" },
  { id: "tecate", emoji: "🍺", name: "Tecate", category: "lager", tagline: "紅罐，墨西哥日常" },
  { id: "dos-equis", emoji: "🍺", name: "Dos Equis", category: "lager", tagline: "雙 X 最有趣" },
  { id: "sol", emoji: "🍺", name: "Sol", category: "lager", tagline: "太陽，曬住飲" },
  { id: "bohemia", emoji: "🍺", name: "Bohemia", category: "lager", tagline: "波希米亞皮爾森" },
  { id: "victoria", emoji: "🍺", name: "Victoria", category: "lager", tagline: "維也納拉格麥香" },
  { id: "indio", emoji: "🍺", name: "Indio", category: "lager", tagline: "深色拉格印第歐" },
  { id: "skol", emoji: "🍺", name: "Skol", category: "lager", tagline: "巴西派對啤" },
  { id: "brahma", emoji: "🍺", name: "Brahma", category: "lager", tagline: "森巴味拉格" },
];

/**
 * Picks one beer at random. Pure function — easy to unit test once vitest lands.
 * Caller is responsible for any async wrapping / timeout handling.
 */
export function pickRandomBeer(): Beer {
  const idx = Math.floor(Math.random() * BEERS.length);
  return BEERS[idx];
}

/* ---- UR A.4 前端接 API ----
 * BEERS 是活目錄：啟動時靜態保底（15 創始＋A.20 已畫 26），`fetchBeers()` 成功即原地換成
 * API 數據（同 id 全覆蓋，調用方零改——所有 pick 函數讀的都是這個引用）。
 * 換源失敗（斷網／500／空表／壞行）回 false，靜態照走，體感不斷。
 * 測試用 `applyBeerCatalog` 直灌＋還原（vitest 檔級隔離，不污染別檔）。 */
export function applyBeerCatalog(rows: Beer[]): void {
  BEERS.length = 0;
  BEERS.push(...rows);
}

/** 按展示名找酒（他人 mock pin／卡按 drinkName 取 icon_url 用）。精確匹配。 */
export function beerByName(name: string): Beer | null {
  return BEERS.find((b) => b.name === name) ?? null;
}

/**
 * UR C.4 目錄新鮮解析（共用層加法，舊調用零影響）：快照 beer 可能过期——
 * DB 回退行 name＝beer_id、emoji＝通用🍺；A.4 換源後目錄 icon_url 也可能
 * 比快照新。按 `beer.id` 對活目錄取新，`beerByName` 兜底，最後原樣返回。
 * v2 開卡／釘圖渲染前調用；v1 未用（BeerIcon 另有自解析，不動）。
 */
export function resolveFreshBeer(stale: Beer): Beer {
  return (
    BEERS.find((b) => b.id === stale.id) ??
    beerByName(stale.name) ??
    stale
  );
}

export async function fetchBeers(): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/beers", { cache: "no-store" });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    const rows = toBeersJson(
      typeof data === "object" && data !== null
        ? (data as { beers?: unknown }).beers
        : null,
    );
    if (rows === null || rows.length === 0) return false;
    applyBeerCatalog(rows);
    return true;
  } catch {
    return false;
  }
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
  /* UR A.20：中國白酒 lane（Moutai；白葡萄酒已佔「白酒」字，lane 名避撞用中國白酒）。 */
  { id: "baijiu", emoji: "🏺", labelKey: "catBaijiu", match: ["spirits"] },
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
 * UR A.5 真下一批 — 優先給沒看過的：同類池先扣掉 `seen`（當前批），
 * 剩的夠 `count` 就只在裡面抽（連點換批不重臉）；不夠（池見底）就回退
 * 整池重洗，不轉空。池 ≤ 已展示數時呼叫方置灰按鈕（不假裝換了）。
 * Unknown lane → 全域池同邏輯。`rand` 可注入測，不動源數組。
 */
export function pickNextBatch(
  seen: readonly Beer[],
  categoryId: string,
  count: number = 6,
  rand: () => number = Math.random,
): Beer[] {
  const lanePool = beersInCategory(categoryId);
  const pool = lanePool.length > 0 ? lanePool : BEERS;
  const seenIds = new Set(seen.map((b) => b.id));
  const fresh = pool.filter((b) => !seenIds.has(b.id));
  const source = fresh.length >= count ? fresh : pool;
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