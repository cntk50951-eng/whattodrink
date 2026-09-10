/**
 * UR A.3 第一個 API：`GET /api/v1/beers` 的查表＋轉 JSON（純函數，可單測）。
 * 欄位與 `lib/beers.ts` Beer 一字不差（過堂結論：id／emoji／name／category
 * 有主，tagline 預留結果卡文案先照回）；DB 行是不可信輸入，逐行校驗，
 * 壞行整批 500（不斷尾——15 行靜態表壞一行就是 seed 錯了，該炸）。
 */

export type BeerJson = {
  id: string;
  emoji: string;
  name: string;
  category: string;
  tagline: string;
  /** 自畫圖標公開 URL；NULL＝還沒畫圖，前端退 emoji（酒圖標切片）。 */
  icon_url: string | null;
};

function isBeerJson(raw: unknown): raw is BeerJson {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.emoji === "string" &&
    typeof r.name === "string" &&
    typeof r.category === "string" &&
    typeof r.tagline === "string" &&
    (r.icon_url === null || typeof r.icon_url === "string")
  );
}

export function toBeersJson(rows: unknown): BeerJson[] | null {
  if (!Array.isArray(rows)) return null;
  if (!rows.every(isBeerJson)) return null;
  return rows.map((r) => ({
    id: r.id,
    emoji: r.emoji,
    name: r.name,
    category: r.category,
    tagline: r.tagline,
    icon_url: r.icon_url,
  }));
}
