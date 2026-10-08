import { describe, expect, it } from "vitest";

import {
  gdeltQueries,
  mapH1Regions,
  mapH2Regions,
  newsLimit,
  normalizeGdeltArticle,
  normalizeRssItem,
  parseGdeltDate,
  snippetOf,
  stripHtml,
} from "./news";

describe("stripHtml", () => {
  it("去标签＋实体＋压空白；非串回空", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>World</b></p>")).toBe("Hello World");
    expect(stripHtml("A &amp; B &lt;C&gt;")).toBe("A & B <C>");
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(42)).toBe("");
  });
});

describe("snippetOf", () => {
  it("有正文取正文；无则截标题 140", () => {
    expect(snippetOf("  正文  ", "标题")).toBe("正文");
    expect(snippetOf("", "标".repeat(200))).toBe("标".repeat(140));
    expect(snippetOf("   ", "标题")).toBe("标题");
  });
});

describe("mapH1Regions", () => {
  it("双 category 展两行；单对单；无→默认 hk", () => {
    expect(mapH1Regions(["Hong Kong", "China"])).toEqual(["hk", "cn"]);
    expect(mapH1Regions(["Hong Kong Wine"])).toEqual(["hk"]);
    expect(mapH1Regions(["China"])).toEqual(["cn"]);
    expect(mapH1Regions([])).toEqual(["hk"]);
    expect(mapH1Regions(null)).toEqual(["hk"]);
  });
});

describe("mapH2Regions", () => {
  it("标题关键词归属；双含两行；都不含→both", () => {
    expect(mapH2Regions("Hong Kong wine fair")).toEqual(["hk"]);
    expect(mapH2Regions("中国葡萄酒市场")).toEqual(["cn"]);
    expect(mapH2Regions("Hong Kong and China wine")).toEqual(["hk", "cn"]);
    expect(mapH2Regions("Bordeaux tasting notes")).toEqual(["both"]);
    // 国际源实形（VinePair／DB）：含香港即 hk，否则 both
    expect(mapH2Regions("Hong Kong's Bar Leone defends crown")).toEqual(["hk"]);
    expect(mapH2Regions("Why Marlborough whites are bucking China's import declines")).toEqual(["cn"]);
  });
});

describe("normalizeRssItem", () => {
  const good = {
    title: " 酒展 ",
    description: "<p>好喝</p>",
    link: "https://example.com/a",
    pubDate: "Wed, 08 Oct 2026 01:00:00 GMT",
  };
  it("多 region 展多行；字段洗干净", () => {
    const rows = normalizeRssItem(good, "Vino Joy", ["hk", "cn"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "酒展",
      snippet: "好喝",
      source: "Vino Joy",
      source_url: "https://example.com/a",
      region: "hk",
    });
  });
  it("坏行整条丢（空标题／坏链接／坏时间）", () => {
    expect(normalizeRssItem({ ...good, title: " " }, "S", ["hk"])).toEqual([]);
    expect(normalizeRssItem({ ...good, link: "ftp://x" }, "S", ["hk"])).toEqual([]);
    expect(normalizeRssItem({ ...good, pubDate: "乱码" }, "S", ["hk"])).toEqual([]);
  });
  it("坏图回 null；空 regions 回退 hk", () => {
    const rows = normalizeRssItem({ ...good, imageUrl: "notaurl" }, "S", []);
    expect(rows).toHaveLength(1);
    expect(rows[0].image_url).toBeNull();
    expect(rows[0].region).toBe("hk");
  });
});

describe("parseGdeltDate", () => {
  it("seendate→ISO ms；非法 NaN", () => {
    expect(parseGdeltDate("20261008T010000Z")).toBe(Date.parse("2026-10-08T01:00:00Z"));
    expect(Number.isNaN(parseGdeltDate("2026-10-08"))).toBe(true);
    expect(Number.isNaN(parseGdeltDate(null))).toBe(true);
  });
});

describe("normalizeGdeltArticle", () => {
  it("归一＋刊名取 domain＋无图 null", () => {
    const r = normalizeGdeltArticle(
      { title: "Wine", url: "https://e.com/1", seendate: "20261008T010000Z", domain: "e.com" },
      "hk",
      "GDELT",
    );
    expect(r).toMatchObject({ source: "e.com", region: "hk", image_url: null });
  });
  it("坏行回 null", () => {
    expect(normalizeGdeltArticle({ title: "", url: "https://e.com" }, "hk", "G")).toBeNull();
  });
});

describe("newsLimit", () => {
  it("默认 20 上限 50；非法回退", () => {
    expect(newsLimit(null)).toBe(20);
    expect(newsLimit("10")).toBe(10);
    expect(newsLimit("99")).toBe(20);
    expect(newsLimit("abc")).toBe(20);
  });
});

describe("gdeltQueries", () => {
  it("清单非空；query 非空；region 合法；含 C2/C3 domain 查询", () => {
    const qs = gdeltQueries();
    expect(qs.length).toBeGreaterThan(0);
    for (const e of qs) {
      expect(e.q.trim()).not.toBe("");
      if ("region" in e) expect(["hk", "cn", "both"]).toContain(e.region);
    }
    expect(qs.some((e) => e.q.includes("domain:winesinfo.com"))).toBe(true);
    expect(qs.some((e) => e.q.includes("domain:wbo529.com"))).toBe(true);
  });
});
