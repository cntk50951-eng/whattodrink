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