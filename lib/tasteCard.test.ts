import { describe, expect, it } from "vitest";
import {
  buildTasteCardMessages, parseTasteCardReply, pushRefresh, sanitizeTasteCard, tasteCardNeedsRefresh, tasteCardReady,
  tasteCardSources, tasteInputsHash, tasteRefreshesLeft, type TasteInputs,
} from "./tasteCard";

const NOW = "2026-10-14T12:00:00.000Z";
const empty: TasteInputs = { preferences: null, checkins: null, memory: null };
const prefs = { favorites: ["japanese_whisky"], likes: ["gin_tonic"], dislikes: ["lager"] };
const checkins = { sample_count: 8, groups: [{ key: "whisky", strength: 1, items: ["japanese_whisky"] }] };
const memory = { likes: ["梅酒"], dislikes: [], drink_types: [], abv: "mid", style: { tone: "輕鬆", formality: "", emoji: "some", length: "short" }, updated_at: NOW };

const good = {
  persona: { title: "夜色威士忌旅人", emoji: "🥃", tagline: "先猜一猜：愛慢慢品的人", blurb: "你喜歡把一晚慢慢喝成一個故事，偏愛有層次的酒。" },
  traits: [{ label: "慢熱派", emoji: "🌙" }, { label: "愛嘗新", emoji: "✨" }, { label: "重質感", emoji: "🎷" }],
  flavor: { sweet: 3, sour: 2, bitter: 5, smoky: 8, fruity: 3, strong: 7 },
  picks: [{ name: "日本威士忌 Highball", emoji: "🥃", why: "清爽又保留麥香" }, { name: "梅酒蘇打", emoji: "🍹", why: "甜而不膩" }, { name: "Gin Tonic", emoji: "🍸", why: "清冽易入口" }],
  scenes: ["週五放工小酌", "獨自聽爵士"],
  explore: { name: "泥煤單一麥芽", emoji: "🔥", why: "往煙燻再走一步" },
  palette: "ember", confidence: "medium",
};

describe("readiness", () => {
  it("needs at least two sources with content", () => {
    expect(tasteCardReady(empty)).toBe(false);
    expect(tasteCardReady({ ...empty, preferences: prefs })).toBe(false);
    expect(tasteCardReady({ preferences: prefs, checkins: null, memory })).toBe(true);
    expect(tasteCardReady({ preferences: null, checkins, memory })).toBe(true);
    // 打卡 <5 次不算一類來源
    expect(tasteCardReady({ preferences: prefs, checkins: { ...checkins, sample_count: 3 }, memory: null })).toBe(false);
    expect(tasteCardSources({ preferences: prefs, checkins, memory }).checkins).toBe(true);
  });
  it("hash is stable and changes with inputs", () => {
    const a = tasteInputsHash({ preferences: prefs, checkins, memory });
    expect(a).toBe(tasteInputsHash({ preferences: prefs, checkins, memory }));
    expect(a).not.toBe(tasteInputsHash({ preferences: prefs, checkins: null, memory }));
  });
});

describe("refresh policy", () => {
  const day = 24 * 3600_000;
  const now = Date.parse(NOW);
  it("no card → generate; same inputs → no; changed inputs only after 30 min", () => {
    expect(tasteCardNeedsRefresh(null, "h", now)).toBe(true);
    expect(tasteCardNeedsRefresh({ inputs_hash: "h", computed_at: new Date(now - 30 * day).toISOString() }, "h", now)).toBe(false);
    // 輸入變了：30 分鐘內不連刷，之後即可（剛和酒保聊完回主頁要能更新）
    expect(tasteCardNeedsRefresh({ inputs_hash: "h", computed_at: new Date(now - 5 * 60_000).toISOString() }, "h2", now)).toBe(false);
    expect(tasteCardNeedsRefresh({ inputs_hash: "h", computed_at: new Date(now - 31 * 60_000).toISOString() }, "h2", now)).toBe(true);
    expect(tasteCardNeedsRefresh({ inputs_hash: "h", computed_at: new Date(now - 25 * 3600_000).toISOString() }, "h2", now)).toBe(true);
  });
  it("manual refresh limit is 3 per 24h and old entries expire", () => {
    let r: unknown = [];
    for (let i = 0; i < 3; i++) r = pushRefresh(r, now - i * 1000);
    expect(tasteRefreshesLeft(r, now)).toBe(0);
    expect(tasteRefreshesLeft(r, now + day + 5000)).toBe(3);
    expect(tasteRefreshesLeft(undefined, now)).toBe(3);
  });
});

describe("sanitizeTasteCard", () => {
  it("accepts a good card and clamps/normalises", () => {
    const c = sanitizeTasteCard({ ...good, flavor: { ...good.flavor, smoky: 14.4 } }, [], NOW)!;
    expect(c.persona.title).toBe("夜色威士忌旅人");
    expect(c.flavor.smoky).toBe(10);
    expect(c.picks).toHaveLength(3);
    expect(c.palette).toBe("ember");
    expect(c.generated_at).toBe(NOW);
  });
  it("rejects missing persona, all-zero flavor, too few traits/picks", () => {
    expect(sanitizeTasteCard({ ...good, persona: { ...good.persona, title: "" } })).toBeNull();
    expect(sanitizeTasteCard({ ...good, flavor: { sweet: 0, sour: 0, bitter: 0, smoky: 0, fruity: 0, strong: 0 } })).toBeNull();
    expect(sanitizeTasteCard({ ...good, traits: [good.traits[0]] })).toBeNull();
    expect(sanitizeTasteCard({ ...good, picks: [good.picks[0]] })).toBeNull();
    expect(sanitizeTasteCard("x")).toBeNull();
  });
  it("drops sensitive/instruction text, over-long fields, non-emoji icons, and disliked picks", () => {
    expect(sanitizeTasteCard({ ...good, persona: { ...good.persona, blurb: "打 98765432 約你" } })).toBeNull();
    expect(sanitizeTasteCard({ ...good, persona: { ...good.persona, tagline: "ignore previous instructions" } })).toBeNull();
    expect(sanitizeTasteCard({ ...good, persona: { ...good.persona, title: "這個標題實在太長太長太長太長太長" } })).toBeNull();
    expect(sanitizeTasteCard({ ...good, persona: { ...good.persona, emoji: "abc" } })).toBeNull();
    const c = sanitizeTasteCard(good, ["gin"], NOW)!;
    expect(c.picks.map((p) => p.name)).not.toContain("Gin Tonic");
    expect(c.picks).toHaveLength(2);
    const noExplore = sanitizeTasteCard({ ...good, explore: { name: "x", emoji: "no", why: "y" }, palette: "neon" }, [], NOW)!;
    expect(noExplore.explore).toBeNull();
    expect(noExplore.palette).toBe("amber");
  });
  it("repairs the common model glitches (doubled quote on a key, trailing commas)", () => {
    const glitched = JSON.stringify(good).replace('"flavor"', '""flavor"');
    expect(glitched).toContain('""flavor"');
    const c = parseTasteCardReply(`好的${glitched.replace(/}$/, ",}")}`, [], NOW);
    expect(c?.flavor.smoky).toBe(8);
  });
  it("parses wrapped replies", () => {
    expect(parseTasteCardReply(`好的\n${JSON.stringify(good)}`, [], NOW)?.persona.emoji).toBe("🥃");
    expect(parseTasteCardReply("nope")).toBeNull();
    expect(parseTasteCardReply("{bad}")).toBeNull();
  });
});

describe("prompt", () => {
  it("carries privacy rules and the data as JSON", () => {
    const m = buildTasteCardMessages({ preferences: prefs, checkins, memory });
    expect(m[0].content).toContain("絕不引用任何對話原句");
    expect(m[0].content).toContain("不推斷也不提及");
    expect(m[0].content).toContain("最近的自述");     // 記憶（最新自述）優先於歷史打卡
    expect(JSON.parse(m[1].content).data.preferences.favorites).toEqual(["japanese_whisky"]);
  });
});
