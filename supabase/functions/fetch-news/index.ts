// UR E.24 酒闻采集 Edge Function（Supabase Dashboard 手动建 Function 粘贴部署＋挂每 2h cron＋首次触发；
// 本仓无 deno/supabase CLI，本地不可验，只验了同口径纯函数 lib/api/news.test.ts）。
// 归一口径与 lib/api/news.ts 同步（stripHtml／snippet140／H1-H2 region 映射／GDELT 日期），改一处同步另一处。
// 需要的 secrets（Dashboard → Edge Functions → Secrets）：SUPABASE_URL、SERVICE_ROLE_KEY（service-role，写库＋prune 用）。
// 成功标志：booze_news 有行＋fetched_at 在 2h 内；单源挂只记 log 不堵批；upsert＋prune 皆幂等可重放。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UA = { "User-Agent": "WhatToDrinkNewsBot/1.0 (+hk-cn wine news)" };

type NewsRegion = "hk" | "cn" | "both";
type NormRow = {
  title: string;
  snippet: string;
  source: string;
  source_url: string;
  image_url: string | null;
  published_at: string;
  region: NewsRegion;
};

// ---- 归一（lib/api/news.ts 同口径精简版） ----

function stripHtml(input: unknown): string {
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

function snippetOf(text: string, title: string, maxLen = 140): string {
  const clean = text.trim();
  const base = clean !== "" ? clean : title.trim();
  return base.length > maxLen ? base.slice(0, maxLen) : base;
}

function mapH1(cats: string[]): NewsRegion[] {
  const hk = cats.some((c) => /Hong Kong/i.test(c));
  const cn = cats.some((c) => /China/i.test(c));
  if (hk && cn) return ["hk", "cn"];
  if (hk) return ["hk"];
  if (cn) return ["cn"];
  return ["hk"];
}

function mapH2(title: string): NewsRegion[] {
  const hk = /香港|Hong Kong/i.test(title);
  const cn = /大陆|大陸|中國|中国|China/i.test(title);
  if (hk && cn) return ["hk", "cn"];
  if (hk) return ["hk"];
  if (cn) return ["cn"];
  return ["both"];
}

function gdeltMs(seen: unknown): number {
  if (typeof seen !== "string") return NaN;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seen.trim());
  if (m === null) return NaN;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}

// ---- RSS 抓取（零依赖正则解析；CDATA 剥壳） ----

type RssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  categories: string[];
  imageUrl: string;
};

function uncdc(s: string): string {
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
}

function tagText(block: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`).exec(block);
  return m === null ? "" : uncdc(m[1]);
}

function tagTexts(block: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const t = uncdc(m[1]);
    if (t !== "") out.push(t);
  }
  return out;
}

function attrUrl(block: string, tag: string, attr: string): string {
  const m = new RegExp(`<${tag}\\b[^>]*?${attr}="([^"]+)"`).exec(block);
  return m === null ? "" : m[1].trim();
}

function firstImg(html: string): string {
  const m = /<img\b[^>]*?src="([^"]+)"/i.exec(html);
  return m === null ? "" : m[1].trim();
}

function parseRss(xml: string): RssItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  return blocks.map((b) => {
    const encoded = tagText(b, "content:encoded");
    return {
      title: tagText(b, "title"),
      link: tagText(b, "link"),
      pubDate: tagText(b, "pubDate"),
      description: tagText(b, "description") !== "" ? tagText(b, "description") : encoded,
      categories: tagTexts(b, "category"),
      imageUrl:
        attrUrl(b, "enclosure", "url") !== ""
          ? attrUrl(b, "enclosure", "url")
          : attrUrl(b, "media:content", "url") !== ""
            ? attrUrl(b, "media:content", "url")
            : firstImg(encoded),
    };
  });
}

function normRssItem(
  it: RssItem,
  source: string,
  regions: NewsRegion[],
): NormRow[] {
  const title = it.title.trim();
  const link = it.link.trim();
  const pubMs = Date.parse(it.pubDate);
  if (title === "" || link === "" || !/^https?:\/\//.test(link) || !Number.isFinite(pubMs)) return [];
  const snippet = snippetOf(stripHtml(it.description), title);
  const img = it.imageUrl.trim();
  const published_at = new Date(pubMs).toISOString();
  const regs = regions.length > 0 ? regions : (["hk"] as NewsRegion[]);
  return regs.map((region) => ({
    title,
    snippet,
    source,
    source_url: link,
    image_url: /^https?:\/\//.test(img) ? img : null,
    published_at,
    region,
  }));
}

async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`rss http ${res.status}`);
  return parseRss(await res.text());
}

// ---- GDELT DOC 2.0（免费免 key） ----

type GdeltQuery = { q: string; region: NewsRegion };

async function fetchGdelt(queries: GdeltQuery[]): Promise<NormRow[]> {
  const rows: NormRow[] = [];
  for (const { q, region } of queries) {
    const url =
      "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
      encodeURIComponent(q) +
      "&mode=artlist&maxrecords=50&sort=datedesc&format=json";
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`gdelt http ${res.status}`);
    const body = (await res.json()) as {
      articles?: { title?: unknown; url?: unknown; seendate?: unknown; socialimage?: unknown; domain?: unknown }[];
    };
    for (const a of body.articles ?? []) {
      const title = typeof a.title === "string" ? a.title.trim() : "";
      const link = typeof a.url === "string" ? a.url.trim() : "";
      const pubMs = gdeltMs(a.seendate);
      if (title === "" || link === "" || !/^https?:\/\//.test(link) || !Number.isFinite(pubMs)) continue;
      const domain =
        typeof a.domain === "string" && a.domain.trim() !== "" ? a.domain.trim() : "GDELT";
      const img = typeof a.socialimage === "string" ? a.socialimage.trim() : "";
      rows.push({
        title,
        snippet: snippetOf("", title),
        source: domain,
        source_url: link,
        image_url: /^https?:\/\//.test(img) ? img : null,
        published_at: new Date(pubMs).toISOString(),
        region,
      });
    }
    if (rows.length === 0) throw new Error("gdelt empty");
  }
  return rows;
}

// ---- 主流程 ----

const GDELT_QUERIES: GdeltQuery[] = [
  { q: "wine Hong Kong sourcecountry:HK", region: "hk" },
  { q: "葡萄酒 sourcecountry:CN", region: "cn" },
];
// G2 降级：仅 G1 抛错／空时启用（同查询分 region）。
const GOOGLE_QUERIES: GdeltQuery[] = [
  { q: "wine Hong Kong", region: "hk" },
  { q: "葡萄酒", region: "cn" },
];
function googleRssUrl(query: string, hl: string, gl: string): string {
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(`${query} when:7d`) +
    `&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`
  );
}

Deno.serve(async (): Promise<Response> => {
  if (SUPABASE_URL === "" || SERVICE_KEY === "") {
    return new Response(JSON.stringify({ ok: false, error: "missing secrets" }), { status: 500 });
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const counts: Record<string, number> = {};
  let rows: NormRow[] = [];

  try {
    const h1 = await fetchRss("https://vino-joy.com/feed/");
    const h1rows = h1.flatMap((it) => normRssItem(it, "Vino Joy", mapH1(it.categories)));
    counts["H1"] = h1rows.length;
    rows = rows.concat(h1rows);
  } catch (e) {
    console.error(`[fetch-news] H1 failed: ${(e as Error).message}`);
    counts["H1"] = -1;
  }

  try {
    const h2 = await fetchRss("https://www.scmp.com/rss/94/feed");
    const h2rows = h2.flatMap((it) => normRssItem(it, "SCMP", mapH2(it.title)));
    counts["H2"] = h2rows.length;
    rows = rows.concat(h2rows);
  } catch (e) {
    console.error(`[fetch-news] H2 failed: ${(e as Error).message}`);
    counts["H2"] = -1;
  }

  try {
    const g1 = await fetchGdelt(GDELT_QUERIES);
    counts["G1"] = g1.length;
    rows = rows.concat(g1);
  } catch (e) {
    console.error(`[fetch-news] G1 failed, fallback G2: ${(e as Error).message}`);
    try {
      const g2hk = await fetchRss(googleRssUrl(GOOGLE_QUERIES[0].q, "en-HK", "HK"));
      const g2cn = await fetchRss(googleRssUrl(GOOGLE_QUERIES[1].q, "zh-CN", "CN"));
      const g2rows = [
        ...g2hk.flatMap((it) => normRssItem(it, "Google News", ["hk"])),
        ...g2cn.flatMap((it) => normRssItem(it, "Google News", ["cn"])),
      ];
      // Google News RSS 链接为 news.google.com 跳转（非原文），仅在 G1 故障时降级收录。
      counts["G2"] = g2rows.length;
      rows = rows.concat(g2rows);
    } catch (e2) {
      console.error(`[fetch-news] G2 failed: ${(e2 as Error).message}`);
      counts["G2"] = -1;
    }
  }

  let upserted = 0;
  if (rows.length > 0) {
    const { error } = await supa
      .from("booze_news")
      .upsert(rows, { onConflict: "source_url,region", ignoreDuplicates: true });
    if (error !== null) {
      console.error(`[fetch-news] upsert error: ${error.message}`);
      return new Response(JSON.stringify({ ok: false, error: "upsert failed" }), { status: 500 });
    }
    upserted = rows.length;
  }
  const pruneBefore = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { error: pErr } = await supa.from("booze_news").delete().lt("published_at", pruneBefore);
  if (pErr !== null) console.error(`[fetch-news] prune error: ${pErr.message}`);

  return new Response(JSON.stringify({ ok: true, counts, normalized: upserted }), {
    headers: { "Content-Type": "application/json" },
  });
});
