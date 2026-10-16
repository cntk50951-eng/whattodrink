/**
 * 打卡自定義標籤（#微醺）純函數。與酒類 tags 分開：不進口味推測，只用於回顧／複用。
 * 規則：去掉前導 #、全形＃；內部空白去掉；1–12 個字；只留字母／數字／下劃線／連字號／間隔點（含中日韓）；
 * 每條打卡最多 5 個，按不分大小寫去重（保留第一次的寫法）。
 */

export const HASHTAG_MAX_COUNT = 5;
export const HASHTAG_MAX_LEN = 12;

const ALLOWED = /^[\p{L}\p{N}_\-·]+$/u;

/** 單個標籤標準化；不合法回 null。 */
export function normalizeHashtag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.normalize("NFKC").replace(/^[#＃\s]+/u, "").replace(/\s+/gu, "").trim();
  if (s === "") return null;
  if ([...s].length > HASHTAG_MAX_LEN) return null;
  if (!ALLOWED.test(s)) return null;
  return s;
}

/** 請求體 hashtags 校驗：缺席回 null；非數組／超量／含非法標籤回 error；合法回標準化去重後的數組。 */
export function parseHashtags(raw: unknown): { hashtags: string[] } | { error: string } | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return { error: "hashtags 需为数组" };
  if (raw.length > HASHTAG_MAX_COUNT) return { error: `hashtags 最多 ${HASHTAG_MAX_COUNT} 个` };
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const n = normalizeHashtag(item);
    if (n === null) return { error: `hashtags 含非法标签（1-${HASHTAG_MAX_LEN} 字，仅文字／数字／_-·）` };
    const k = n.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  }
  return { hashtags: out };
}

/** 讀側：任何形狀 → 乾淨的字符串數組（缺列／壞值回 []）。 */
export function readHashtags(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as unknown[]).filter((x): x is string => typeof x === "string") : [];
}
