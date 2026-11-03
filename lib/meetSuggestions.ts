/**
 * 遇見「想找什麼」每日推薦語（iOS enhancement_nov2_01 #21）。
 * 純函數層（可單測）：語言選擇、聚合統計→提示詞、LLM 回覆清洗。
 * 這是**平台級**內容（不是個人化）：只用最近 20 天「公開」打卡的聚合數據，不取任何個人可識別內容，
 * 所以可以按語言緩存、全員共用。接口與批處理見 `app/api/v1/meet/suggestions`、`app/api/internal/meet-suggestions`。
 */

export const SUGGESTION_LANGS = ["zh-Hant", "zh-Hans", "en"] as const;
export type SuggestionLang = (typeof SUGGESTION_LANGS)[number];

/** 客戶端只認這幾個圖標名，其餘 iOS 會換成 sparkles。 */
export const SUGGESTION_ICONS = [
  "person.2.fill",
  "wineglass",
  "party.popper.fill",
  "sparkles",
  "moon.stars.fill",
  "music.note",
  "fork.knife",
  "mappin.and.ellipse",
] as const;

export const SUGGESTION_MAX = 4;
export const SUGGESTION_MIN = 3;
/** 每條推薦語的字數上限（會直接當搜索詞，也要放得進一行／兩行）。 */
export const SUGGESTION_TEXT_MAX = 30;
export const STATS_WINDOW_DAYS = 20;

export type SuggestionItem = { id: string; text: string; icon: string };

export type SuggestionStats = {
  /** 最近 N 天公開打卡最多的地點（名稱，最多 8 個） */
  topPlaces: string[];
  /** 最近 N 天公開打卡總數 */
  checkinCount: number;
  /** 晚間（20–04 點）打卡占比 0–1 */
  nightShare: number;
};

/** 按 Accept-Language 挑語言；認不出就繁體（主要用戶在香港）。 */
export function pickSuggestionLang(acceptLanguage: string | null | undefined): SuggestionLang {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("en")) return "en";
  if (first.startsWith("zh-hans") || first.startsWith("zh-cn") || first.startsWith("zh-sg")) return "zh-Hans";
  return "zh-Hant";
}

const LANG_NAME: Record<SuggestionLang, string> = {
  "zh-Hant": "繁體中文（香港口語，可帶少量粵語詞）",
  "zh-Hans": "简体中文（口语）",
  en: "English (casual, Hong Kong nightlife tone)",
};

export function statsFromCheckins(
  rows: { place_name: string | null; created_at: string | null }[],
  hkHourOf: (iso: string) => number,
): SuggestionStats {
  const counts = new Map<string, number>();
  let night = 0;
  let total = 0;
  for (const r of rows) {
    total += 1;
    const p = (r.place_name ?? "").trim();
    if (p !== "" && p.length <= 40) counts.set(p, (counts.get(p) ?? 0) + 1);
    if (r.created_at !== null) {
      const h = hkHourOf(r.created_at);
      if (h >= 20 || h < 4) night += 1;
    }
  }
  const topPlaces = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
  return { topPlaces, checkinCount: total, nightShare: total === 0 ? 0 : Math.round((night / total) * 100) / 100 };
}

/** 香港時區的小時（0–23）。 */
export function hkHour(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 12;
  return (d.getUTCHours() + 8) % 24;
}

export function buildSuggestionPrompt(lang: SuggestionLang, stats: SuggestionStats): { system: string; user: string } {
  const system = [
    "你是香港酒吧／酒局社交 App「遇見」的文案助手。任務：生成 4 條「用戶可能想在遇見裡搜的一句話」。",
    "遇見的搜索能理解：找人（性別、年齡、口味）、找酒吧（附近、營業時間）、找酒局（今晚、周末）。",
    `語言：${LANG_NAME[lang]}。`,
    "要求：每條 ≤ 20 個字（英文 ≤ 12 個詞）、口語、可以直接當搜索詞、有畫面感、彼此不重複；",
    "三類（找人／找酒吧／找酒局）各至少一條；不要出現具體個人名字、電話、網址、成人露骨或歧視內容；不要編造數字。",
    '只輸出 JSON：{"suggestions":[{"text":"…","icon":"person.2.fill|wineglass|party.popper.fill|sparkles|moon.stars.fill|music.note|fork.knife|mappin.and.ellipse"}]}，不要任何其他文字。',
  ].join("\n");
  const places = stats.topPlaces.length > 0 ? stats.topPlaces.join("、") : "（暫無）";
  const user = [
    `最近 ${STATS_WINDOW_DAYS} 天平台公開打卡的聚合資料（僅供找靈感，勿照抄成個人信息）：`,
    `- 打卡總數：${stats.checkinCount}`,
    `- 晚間打卡占比：${Math.round(stats.nightShare * 100)}%`,
    `- 熱門地點：${places}`,
    "請據此生成 4 條推薦語。",
  ].join("\n");
  return { system, user };
}

const BAD_PATTERN = /(https?:\/\/|www\.|@\w|\d{7,})/i;

/**
 * 清洗 LLM 回覆：容忍 ```json 圍欄；逐條裁切、去重、白名單圖標、擋網址／郵箱／長數字；
 * 回傳 id 以 `YYYY-MM-DD-序號` 形式，客戶端當 key 用。不足 SUGGESTION_MIN 條回 null（整批作廢，保留昨天那批）。
 */
export function sanitizeSuggestions(replyText: string, day: string): SuggestionItem[] | null {
  const text = replyText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    if (m === null) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const arr = (parsed as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(arr)) return null;
  const out: SuggestionItem[] = [];
  const seen = new Set<string>();
  for (const it of arr) {
    if (typeof it !== "object" || it === null) continue;
    const r = it as Record<string, unknown>;
    const t = typeof r.text === "string" ? r.text.trim().replace(/\s+/g, " ") : "";
    if (t === "" || t.length > SUGGESTION_TEXT_MAX || BAD_PATTERN.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const icon = typeof r.icon === "string" && (SUGGESTION_ICONS as readonly string[]).includes(r.icon) ? r.icon : "sparkles";
    out.push({ id: `${day}-${out.length + 1}`, text: t, icon });
    if (out.length >= SUGGESTION_MAX) break;
  }
  return out.length >= SUGGESTION_MIN ? out : null;
}

/** 當天（香港）日期 YYYY-MM-DD。 */
export function hkDay(now: Date): string {
  const t = new Date(now.getTime() + 8 * 3600_000);
  return t.toISOString().slice(0, 10);
}
