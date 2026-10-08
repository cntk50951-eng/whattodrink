/**
 * UR E.24 酒闻归一纯函数（可单测）。
 * Edge Function（`supabase/functions/fetch-news/index.ts`，Deno）内联同口径精简版；
 * 改一处同步另一处（运行时隔离，无法 import）。
 */

export type NewsRegion = "hk" | "cn" | "both";

export type NormalizedNews = {
  title: string;
  snippet: string;
  source: string;
  source_url: string;
  image_url: string | null;
  published_at: string;
  region: NewsRegion;
};

export type RawRssItem = {
  title?: unknown;
  description?: unknown;
  link?: unknown;
  pubDate?: unknown;
  categories?: unknown;
  imageUrl?: unknown;
};

export type RawGdeltArticle = {
  title?: unknown;
  url?: unknown;
  seendate?: unknown;
  socialimage?: unknown;
  domain?: unknown;
};

/** 去 HTML 标签＋常见实体（RSS description 含富文本；snippet 入库前洗）。 */
export function stripHtml(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** snippet：正文有取正文，无则截标题 140 字（交接 §2）。 */
export function snippetOf(text: string, title: string, maxLen = 140): string {
  const clean = text.trim();
  const base = clean !== "" ? clean : title.trim();
  return base.length > maxLen ? base.slice(0, maxLen) : base;
}

/** H1 Vino Joy：category 含 Hong Kong→hk，China→cn；都有→两行；都不含→默认 hk（HK 本地刊）。 */
export function mapH1Regions(categories: unknown): NewsRegion[] {
  const cats = Array.isArray(categories)
    ? categories.filter((c): c is string => typeof c === "string")
    : [];
  const hasHk = cats.some((c) => /Hong Kong/i.test(c));
  const hasCn = cats.some((c) => /China/i.test(c));
  if (hasHk && hasCn) return ["hk", "cn"];
  if (hasHk) return ["hk"];
  if (hasCn) return ["cn"];
  return ["hk"];
}

/** H2 SCMP：标题关键词归属；都有→两行；都不含→both（交接原文）。 */
export function mapH2Regions(title: unknown): NewsRegion[] {
  const t = typeof title === "string" ? title : "";
  const hk = /香港|Hong Kong/i.test(t);
  const cn = /大陆|大陸|中國|中国|China/i.test(t);
  if (hk && cn) return ["hk", "cn"];
  if (hk) return ["hk"];
  if (cn) return ["cn"];
  return ["both"];
}

/** RSS 单条归一（一源多 region 展多行；标题／链接／时间非法整条丢）。 */
export function normalizeRssItem(
  raw: RawRssItem,
  source: string,
  regions: NewsRegion[],
): NormalizedNews[] {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const link = typeof raw.link === "string" ? raw.link.trim() : "";
  const pubMs = typeof raw.pubDate === "string" ? Date.parse(raw.pubDate) : NaN;
  if (title === "" || link === "" || !/^https?:\/\//.test(link) || !Number.isFinite(pubMs)) {
    return [];
  }
  const snippet = snippetOf(stripHtml(raw.description), title);
  const imgRaw = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
  const image_url = /^https?:\/\//.test(imgRaw) ? imgRaw : null;
  const published_at = new Date(pubMs).toISOString();
  const regs = regions.length > 0 ? regions : (["hk"] as NewsRegion[]);
  return regs.map((region) => ({ title, snippet, source, source_url: link, image_url, published_at, region }));
}

/** GDELT seendate `20261008T120000Z` → ms（非法回 NaN，调用方丢行）。 */
export function parseGdeltDate(seen: unknown): number {
  if (typeof seen !== "string") return NaN;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seen.trim());
  if (m === null) return NaN;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

/** GDELT 单篇归一（region 由查询决定；snippet 无则截标题 140；刊名取 domain）。 */
export function normalizeGdeltArticle(
  raw: RawGdeltArticle,
  region: NewsRegion,
  fallbackSource: string,
): NormalizedNews | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const pubMs = parseGdeltDate(raw.seendate);
  if (title === "" || url === "" || !/^https?:\/\//.test(url) || !Number.isFinite(pubMs)) {
    return null;
  }
  const domain = typeof raw.domain === "string" && raw.domain.trim() !== "" ? raw.domain.trim() : fallbackSource;
  const imgRaw = typeof raw.socialimage === "string" ? raw.socialimage.trim() : "";
  return {
    title,
    snippet: snippetOf("", title),
    source: domain,
    source_url: url,
    image_url: /^https?:\/\//.test(imgRaw) ? imgRaw : null,
    published_at: new Date(pubMs).toISOString(),
    region,
  };
}

/** `GET /news` limit（默认 20 上限 50，沿 parties 口径）。 */
export function newsLimit(raw: unknown, def = 20, max = 50): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= max ? n : def;
}
