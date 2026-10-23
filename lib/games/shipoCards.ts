/**
 * 老實人·識破（shipo）卡牌庫（種子 5 張）。圖片在 iOS 包內按 code 取，伺服器只管文案與難度。
 * 文案來自 iOS 倉 docs/design/games/shipo-images-ready/shipo-cards.json。
 * ⚠️ 真相是常識草稿，上線前須人手覆核。
 */
export type ShipoLang = "zh-Hans" | "zh-Hant" | "en";
export type ShipoText = Record<ShipoLang, string>;

export type ShipoCard = {
  code: string;
  category: ShipoText;
  /** 題面分＝難度星數（1–3） */
  difficulty: 1 | 2 | 3;
  title: ShipoText;
  truth: ShipoText;
  source: ShipoText;
};

export const SHIPO_CARDS: readonly ShipoCard[] = [
  {
    code: "shipo-hammurabi",
    category: { "zh-Hans": "历史", "zh-Hant": "歷史", en: "History" },
    difficulty: 2,
    title: { "zh-Hans": "汉谟拉比法典", "zh-Hant": "漢摩拉比法典", en: "Code of Hammurabi" },
    truth: { "zh-Hans": "约公元前1750年前后由巴比伦王汉谟拉比颁布，刻于高约2.25米的黑色玄武岩石柱上。1901-02年在苏萨出土，现藏巴黎卢浮宫。", "zh-Hant": "約公元前1750年前後由巴比倫王漢摩拉比頒布，刻於高約2.25米的黑色玄武岩石柱上。1901-02年在蘇薩出土，現藏巴黎羅浮宮。", en: "Issued by King Hammurabi of Babylon around 1750 BCE and carved on a dark basalt stele about 2.25 m tall. Excavated at Susa in 1901-02, it is now in the Louvre, Paris." },
    source: { "zh-Hans": "出处：卢浮宫藏品说明", "zh-Hant": "出處：羅浮宮藏品說明", en: "Louvre Museum collection notes" },
  },
  {
    code: "shipo-pyramid",
    category: { "zh-Hans": "环球", "zh-Hant": "環球", en: "World" },
    difficulty: 2,
    title: { "zh-Hans": "吉萨哈夫拉金字塔", "zh-Hant": "吉薩哈夫拉金字塔", en: "Pyramid of Khafre, Giza" },
    truth: { "zh-Hans": "由法老哈夫拉建于约公元前2570年，是吉萨第二大金字塔。它看起来最高，其实是因为建在更高的地势上；顶部至今保留着原始的光滑覆面石。", "zh-Hant": "由法老哈夫拉建於約公元前2570年，是吉薩第二大金字塔。它看起來最高，其實是因為建在更高的地勢上；頂部至今保留著原始的光滑覆面石。", en: "Built for Pharaoh Khafre around 2570 BCE, this is the second-largest pyramid at Giza. It only appears the tallest because it stands on higher ground — and it still keeps its smooth original casing stones near the top." },
    source: { "zh-Hans": "出处：联合国教科文组织世界遗产名录", "zh-Hant": "出處：聯合國教科文組織世界遺產名錄", en: "UNESCO World Heritage listing, Memphis and its Necropolis" },
  },
  {
    code: "shipo-mogao",
    category: { "zh-Hans": "文化", "zh-Hant": "文化", en: "Culture" },
    difficulty: 2,
    title: { "zh-Hans": "敦煌莫高窟九层楼", "zh-Hant": "敦煌莫高窟九層樓", en: "Mogao Caves — Nine-Storey Temple" },
    truth: { "zh-Hans": "莫高窟始建于366年，现存洞窟735座，以佛教壁画和塑像闻名。1900年发现藏经洞，1987年列入世界遗产名录。", "zh-Hant": "莫高窟始建於366年，現存洞窟735座，以佛教壁畫和塑像聞名。1900年發現藏經洞，1987年列入世界遺產名錄。", en: "First excavated in 366 CE, the Mogao Caves preserve 735 caves famed for Buddhist murals and statues. The sealed Library Cave was discovered in 1900, and the site joined the UNESCO World Heritage List in 1987." },
    source: { "zh-Hans": "出处：联合国教科文组织世界遗产名录", "zh-Hant": "出處：聯合國教科文組織世界遺產名錄", en: "UNESCO World Heritage listing, Mogao Caves" },
  },
  {
    code: "shipo-marathon",
    category: { "zh-Hans": "体育", "zh-Hant": "體育", en: "Sports" },
    difficulty: 1,
    title: { "zh-Hans": "马拉松", "zh-Hant": "馬拉松", en: "The Marathon" },
    truth: { "zh-Hans": "传说（非史实）：公元前490年，一名希腊士兵从马拉松跑回雅典报捷。现代马拉松标准距离42.195公里定于1908年伦敦奥运会。", "zh-Hant": "傳說（非史實）：公元前490年，一名希臘士兵從馬拉松跑回雅典報捷。現代馬拉松標準距離42.195公里定於1908年倫敦奧運會。", en: "Legend (not fact) says a Greek soldier ran from Marathon to Athens in 490 BCE to report victory. The modern standard distance of 42.195 km was set at the 1908 London Olympics." },
    source: { "zh-Hans": "出处：世界田联 / 奥林匹克纪录", "zh-Hant": "出處：世界田聯 / 奧林匹克紀錄", en: "World Athletics / Olympic records" },
  },
  {
    code: "shipo-boba",
    category: { "zh-Hans": "生活", "zh-Hant": "生活", en: "Daily Life" },
    difficulty: 1,
    title: { "zh-Hans": "珍珠奶茶", "zh-Hant": "珍珠奶茶", en: "Bubble Milk Tea" },
    truth: { "zh-Hans": "珍珠奶茶1980年代起源于台湾台中。春水堂与翰林茶馆都声称是首创，两说并存，至今没有定论。", "zh-Hant": "珍珠奶茶1980年代起源於台灣台中。春水堂與翰林茶館都聲稱是首創，兩說並存，至今沒有定論。", en: "Bubble milk tea originated in Taichung, Taiwan, in the 1980s. Two tea houses, Chun Shui Tang and Hanlin, both claim to have invented it — the dispute has never been settled, so both claims stand." },
    source: { "zh-Hans": "出处：台湾饮食史报道；起源两说并存", "zh-Hant": "出處：台灣飲食史報道；起源兩說並存", en: "Taiwan food-history reporting; origin disputed by design" },
  },
] as const;

export function shipoCardByCode(code: string): ShipoCard | null {
  return SHIPO_CARDS.find((c) => c.code === code) ?? null;
}

export function pickShipoLang(raw: string | null | undefined): ShipoLang {
  const s = (raw ?? "").toLowerCase();
  if (s.startsWith("en")) return "en";
  if (s.startsWith("zh-hans") || s.startsWith("zh-cn") || s.startsWith("zh-sg")) return "zh-Hans";
  return "zh-Hant";
}
