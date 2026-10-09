/**
 * UR E.28 口味偏好＋标签＋推测（纯函数层，可单测）。
 * Taxonomy 照交接第三节（大类＋子类全局唯一；iOS 只存 key，中文本地映射）。
 * v1 纯确定性聚合（不调 AI；iOS 文案须称"根據打卡推測"，见 backlog）。
 */

export const TASTE_GROUPS = {
  beer: ["lager", "craft", "ipa", "hazy_ipa", "pale_ale", "pilsner", "wheat", "stout", "porter", "sour", "gose", "saison", "belgian_ale", "fruit_beer", "radler", "bock", "dark_lager"],
  whisky: ["japanese_whisky", "scotch", "single_malt", "blended_scotch", "bourbon", "irish_whiskey", "peated", "islay", "speyside", "highland", "lowland", "campbeltown", "islands", "rye", "tennessee", "taiwan_whisky", "canadian_whisky", "world_whisky"],
  cocktail: ["highball", "classic", "signature", "spritz", "tiki", "mocktail", "old_fashioned", "negroni", "martini", "espresso_martini", "margarita", "mojito", "whisky_sour", "gin_tonic", "moscow_mule", "daiquiri", "manhattan", "cosmopolitan", "paper_plane", "penicillin", "mai_tai", "pina_colada", "long_island", "bloody_mary", "tom_collins", "sidecar", "french_75", "boulevardier", "caipirinha", "white_russian", "pisco_sour", "singapore_sling"],
  wine: ["red", "white", "rose", "orange_wine", "natural", "dessert", "icewine", "port", "sherry", "madeira", "bordeaux", "burgundy", "cabernet_sauvignon", "merlot", "pinot_noir", "syrah", "malbec", "tempranillo", "nebbiolo", "sangiovese", "chardonnay", "sauvignon_blanc", "riesling", "pinot_grigio", "chenin_blanc", "moscato"],
  sparkling: ["champagne", "prosecco", "cava", "cremant", "lambrusco", "asti", "sparkling_rose"],
  sake: ["junmai_daiginjo", "junmai_ginjo", "junmai", "daiginjo", "ginjo", "honjozo", "tokubetsu", "nigori", "namazake", "sparkling_sake", "umeshu", "yuzushu", "genshu", "koshu"],
  korean: ["soju", "fruit_soju", "somaek", "makgeolli", "bokbunja", "cheongju"],
  chinese: ["meiguilu", "shaoxing", "huadiao", "huangjiu", "kaoliang", "baijiu", "jiangxiang_baijiu", "nongxiang_baijiu", "qingxiang_baijiu", "mixiang_baijiu", "fengxiang_baijiu", "wujiapi", "yaojiu", "mijiu", "osmanthus_wine"],
  gin: ["london_dry_gin", "old_tom_gin", "plymouth_gin", "genever", "sloe_gin", "flavoured_gin"],
  rum: ["white_rum", "gold_rum", "dark_rum", "spiced_rum", "aged_rum", "rhum_agricole", "cachaca"],
  tequila: ["tequila_blanco", "tequila_reposado", "tequila_anejo", "tequila_extra_anejo", "mezcal"],
  brandy: ["cognac", "xo_cognac", "armagnac", "calvados", "pisco", "grappa", "kirsch", "spanish_brandy"],
  shochu: ["imo_shochu", "mugi_shochu", "kome_shochu", "awamori", "kokuto_shochu", "soba_shochu"],
  liqueur: ["amaro", "vermouth", "aperitivo", "coffee_liqueur", "cream_liqueur", "orange_liqueur", "herbal_liqueur", "nut_liqueur", "bitters"],
  spirits: ["vodka", "flavored_vodka", "absinthe", "aquavit", "anise_spirit"],
  other: ["fruit_wine", "cider", "perry", "mead", "chuhai", "rtd", "hard_seltzer"],
  zero: ["zero_beer", "zero_spirit", "zero_wine"],
} as const;

/** Taxonomy 版本（大类归属变更即 bump；缓存 payload 带 v，旧版强制重算，零迁移）。 */
export const TAXONOMY_VERSION = 2;

export type TasteGroupKey = keyof typeof TASTE_GROUPS;

const SUB_TO_GROUP = new Map<string, TasteGroupKey>();
for (const [g, subs] of Object.entries(TASTE_GROUPS)) {
  for (const s of subs as readonly string[]) SUB_TO_GROUP.set(s, g as TasteGroupKey);
}

/** 合法 key（大类或子类；未知写入 400）。 */
export function isTasteKey(key: unknown): boolean {
  if (typeof key !== "string") return false;
  return key in TASTE_GROUPS || SUB_TO_GROUP.has(key);
}

/** 子类→大类（大类 key 自反；未知回 null）。 */
export function groupOfKey(key: string): TasteGroupKey | null {
  if (key in TASTE_GROUPS) return key as TasteGroupKey;
  return SUB_TO_GROUP.get(key) ?? null;
}

/**
 * `beers.category`（自由散文）→taxonomy 信号。先精确子类命中，再显式映射，
 * 命中不了回 null（该打卡无信号，不计 sample）。
 */
const BEER_CATEGORY_MAP: Record<string, { group: TasteGroupKey; sub: string | null }> = {
  lager: { group: "beer", sub: "lager" },
  "craft beer": { group: "beer", sub: "craft" },
  craft: { group: "beer", sub: "craft" },
  draft: { group: "beer", sub: "lager" },
  ipa: { group: "beer", sub: "ipa" },
  stout: { group: "beer", sub: "stout" },
  wheat: { group: "beer", sub: "wheat" },
  "red wine": { group: "wine", sub: "red" },
  "white wine": { group: "wine", sub: "white" },
  rose: { group: "wine", sub: "rose" },
  whisky: { group: "whisky", sub: null },
  whiskey: { group: "whisky", sub: null },
  cocktail: { group: "cocktail", sub: null },
  highball: { group: "cocktail", sub: "highball" },
  mocktail: { group: "cocktail", sub: "mocktail" },
  sake: { group: "sake", sub: null },
  junmai: { group: "sake", sub: "junmai" },
  daiginjo: { group: "sake", sub: "daiginjo" },
  umeshu: { group: "sake", sub: "umeshu" },
  shochu: { group: "shochu", sub: null },
  soju: { group: "korean", sub: "soju" },
  gin: { group: "gin", sub: null },
  rum: { group: "rum", sub: null },
  vodka: { group: "spirits", sub: "vodka" },
  brandy: { group: "brandy", sub: null },
  baijiu: { group: "chinese", sub: "baijiu" },
  tequila: { group: "tequila", sub: null },
  cider: { group: "other", sub: "cider" },
  makgeolli: { group: "korean", sub: "makgeolli" },
  "pale ale": { group: "beer", sub: "pale_ale" },
  "hazy ipa": { group: "beer", sub: "hazy_ipa" },
  sparkling: { group: "sparkling", sub: null },
};

export function beerCategorySignal(
  category: unknown,
): { group: TasteGroupKey; sub: string | null } | null {
  if (typeof category !== "string") return null;
  const norm = category.trim().toLowerCase();
  if (SUB_TO_GROUP.has(norm)) return { group: SUB_TO_GROUP.get(norm) as TasteGroupKey, sub: norm };
  if (norm in TASTE_GROUPS) return { group: norm as TasteGroupKey, sub: null };
  return BEER_CATEGORY_MAP[norm] ?? null;
}

export type TastePreferences = {
  favorites: string[];
  likes: string[];
  dislikes: string[];
};

/**
 * `PATCH /me preferences` 校验（整体替换；null 清空由调用方判）。
 * favorites ≤3／likes,dislikes ≤8；三数组互斥；全已知 key；
 * favorites＋likes 至少一非空（否则调用方按 null 清空，沿交接标题规则）。
 */
export function parsePreferences(raw: unknown): { body: TastePreferences } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "preferences 需为对象" };
  const r = raw as Record<string, unknown>;
  const read = (k: string, cap: number): string[] | null => {
    const v = r[k];
    if (v === undefined) return [];
    if (!Array.isArray(v)) return null;
    if (v.length > cap) return null;
    const out: string[] = [];
    for (const item of v) {
      if (typeof item !== "string" || !isTasteKey(item)) return null;
      if (!out.includes(item)) out.push(item);
    }
    return out;
  };
  const favorites = read("favorites", 3);
  const likes = read("likes", 8);
  const dislikes = read("dislikes", 8);
  if (favorites === null || likes === null || dislikes === null) {
    return { error: "preferences 非法（未知 key／超限／互斥见下）" };
  }
  const seen = new Set<string>();
  for (const k of [...favorites, ...likes, ...dislikes]) {
    if (seen.has(k)) return { error: "preferences 三组互斥（同 key 不可两处）" };
    seen.add(k);
  }
  if (favorites.length === 0 && likes.length === 0) {
    return { error: "preferences 须有最爱或喜欢（否则传 null 清空）" };
  }
  return { body: { favorites, likes, dislikes } };
}

/** 打卡 tags 校验（≤5／已知／去重；缺席回 null 表"没传"，调用方区别对待）。 */
export function parseTags(raw: unknown): { tags: string[] } | { error: string } | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return { error: "tags 需为数组" };
  if (raw.length > 5) return { error: "tags 最多 5 个" };
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isTasteKey(item)) {
      return { error: "tags 含未知 key" };
    }
    if (!out.includes(item)) out.push(item);
  }
  return { tags: out };
}

export type TasteSignal = {
  /** 打卡 tags（空即无）；无 tags 时用酒款映射兜底。 */
  tags: string[];
  /** beers.category（自由文本，可空）。 */
  beerCategory: string | null;
};

export type TasteGroupOut = {
  key: string;
  strength: number;
  items: { key: string; strength: number }[];
};

/**
 * 确定性聚合（v1 唯一算法）：tags 计数＋无 tags 用酒款映射兜底；
 * 大类 strength＝组计数／最高组计数；子类＝组内计数／组内最高；零值不回。
 * sample_count＝有信号打卡数；<5 时调用方回 groups []（仍回数，沿空状态约定）。
 */
export function aggregateTaste(signals: TasteSignal[]): {
  groups: TasteGroupOut[];
  sample_count: number;
} {
  const subCount = new Map<string, number>();
  const groupCount = new Map<string, number>();
  let sample = 0;
  for (const s of signals) {
    let hit = false;
    const bump = (group: string, sub: string | null): void => {
      hit = true;
      groupCount.set(group, (groupCount.get(group) ?? 0) + 1);
      if (sub !== null) subCount.set(sub, (subCount.get(sub) ?? 0) + 1);
    };
    if (s.tags.length > 0) {
      for (const t of s.tags) {
        const g = groupOfKey(t);
        if (g === null) continue;
        bump(g, SUB_TO_GROUP.has(t) ? t : null);
      }
    } else {
      const sig = beerCategorySignal(s.beerCategory);
      if (sig !== null) bump(sig.group, sig.sub);
    }
    if (hit) sample += 1;
  }
  const maxGroup = Math.max(0, ...groupCount.values());
  const groups: TasteGroupOut[] = [];
  if (maxGroup > 0) {
    for (const [g, n] of groupCount) {
      const subs = (TASTE_GROUPS[g as TasteGroupKey] as readonly string[]).filter((sub) =>
        (subCount.get(sub) ?? 0) > 0,
      );
      const maxSub = Math.max(0, ...subs.map((sub) => subCount.get(sub) ?? 0));
      groups.push({
        key: g,
        strength: n / maxGroup,
        items: subs.map((sub) => ({
          key: sub,
          strength: maxSub > 0 ? (subCount.get(sub) ?? 0) / maxSub : 0,
        })),
      });
    }
  }
  return { groups, sample_count: sample };
}
