/**
 * UR H.3 誰是臥底詞庫（伺服器端選詞：詞必須在 server 決定，手機端不可信）。
 * 內容資料，與 iOS `SpyWordBank`（單機練習局）同源；⚠ 人手按常識整理，未經本地用戶覆核。
 * pack：tea 茶記／hotpot 火鍋／place 地方／night 夜生活／culture 文化。
 */

export const SPY_PACKS = ["tea", "hotpot", "place", "night", "culture"] as const;
export type SpyPack = (typeof SPY_PACKS)[number];

export type SpyWordPair = { pack: SpyPack; a: string; b: string };

export const SPY_WORDS: readonly SpyWordPair[] = [
  { pack: "tea", a: "奶茶", b: "鴛鴦" },
  { pack: "tea", a: "菠蘿油", b: "蛋撻" },
  { pack: "tea", a: "魚蛋", b: "牛雜" },
  { pack: "tea", a: "西多士", b: "奶油多士" },
  { pack: "tea", a: "通粉", b: "公仔麵" },
  { pack: "tea", a: "凍檸茶", b: "凍檸樂" },
  { pack: "hotpot", a: "肥牛", b: "牛柏葉" },
  { pack: "hotpot", a: "魚皮餃", b: "墨魚丸" },
  { pack: "hotpot", a: "腐竹", b: "響鈴" },
  { pack: "hotpot", a: "麻辣鍋底", b: "清湯鍋底" },
  { pack: "place", a: "旺角", b: "尖沙咀" },
  { pack: "place", a: "蘭桂坊", b: "SOHO" },
  { pack: "place", a: "太平山", b: "獅子山" },
  { pack: "place", a: "天星小輪", b: "叮叮" },
  { pack: "place", a: "茶餐廳", b: "大排檔" },
  { pack: "place", a: "港鐵", b: "小巴" },
  { pack: "night", a: "大話骰", b: "十五二十" },
  { pack: "night", a: "啤酒", b: "氣泡酒" },
  { pack: "night", a: "K房", b: "Party Room" },
  { pack: "night", a: "威士忌", b: "白蘭地" },
  { pack: "night", a: "Mojito", b: "Margarita" },
  { pack: "night", a: "夜蒲", b: "宵夜" },
  { pack: "culture", a: "演唱會", b: "音樂節" },
  { pack: "culture", a: "麻雀", b: "撲克" },
  { pack: "culture", a: "廣東歌", b: "K-pop" },
  { pack: "culture", a: "無間道", b: "英雄本色" },
];
