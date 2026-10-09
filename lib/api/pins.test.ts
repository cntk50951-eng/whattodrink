import { describe, expect, it } from "vitest";

import {
  capCount,
  fuzzCoordinate,
  isBboxOverlapsHK,
  parseBbox,
  parsePinsParams,
  parseRange,
  parseSince,
  PINS_RANGE_DEFAULT,
  toPinJson,
} from "./pins";

describe("fuzzCoordinate", () => {
  it("truncates to 3 decimals, not rounds", () => {
    expect(fuzzCoordinate(22.27889)).toBe(22.278);
    expect(fuzzCoordinate(114.18299)).toBe(114.182);
    expect(fuzzCoordinate(22.2783)).toBe(22.278);
    expect(fuzzCoordinate(-1.2349)).toBe(-1.234);
  });
});

describe("parseBbox", () => {
  it("parses valid bbox", () => {
    const r = parseBbox("113.8,22.15,114.44,22.58");
    expect("bbox" in r && r.bbox).toEqual({ west: 113.8, south: 22.15, east: 114.44, north: 22.58 });
  });

  it("rejects missing/empty, wrong count, non-numeric", () => {
    expect(parseBbox(null)).toHaveProperty("error");
    expect(parseBbox("")).toHaveProperty("error");
    expect(parseBbox("1,2,3")).toHaveProperty("error");
    expect(parseBbox("a,b,c,d")).toHaveProperty("error");
  });

  it("rejects reversed and out-of-range", () => {
    expect(parseBbox("114,22,113,23")).toHaveProperty("error"); // west>=east
    expect(parseBbox("113,23,114,22")).toHaveProperty("error"); // south>=north
    expect(parseBbox("-200,0,0,10")).toHaveProperty("error");
    expect(parseBbox("0,-100,1,10")).toHaveProperty("error");
  });

  it("rejects area too large", () => {
    expect(parseBbox("-180,-90,180,90")).toHaveProperty("error");
  });
});

describe("parseRange", () => {
  it("defaults to 7d when missing", () => {
    expect(parseRange(null)).toEqual({ range: "7d" });
    expect(parseRange("")).toEqual({ range: "7d" });
    expect(PINS_RANGE_DEFAULT).toBe("7d");
  });

  it("parses 7d and 90d", () => {
    expect(parseRange("7d")).toEqual({ range: "7d" });
    expect(parseRange("90d")).toEqual({ range: "90d" });
  });

  it("rejects invalid range", () => {
    expect(parseRange("bad")).toHaveProperty("error");
    expect(parseRange("30d")).toHaveProperty("error");
  });
});

describe("parsePinsParams", () => {
  it("defaults limit 100 and range 7d", () => {
    const r = parsePinsParams(new URLSearchParams("bbox=113.8,22.15,114.44,22.58"));
    expect(r).toEqual({ bbox: { west: 113.8, south: 22.15, east: 114.44, north: 22.58 }, limit: 100, range: "7d", scope: "all" });
  });

  it("validates limit 1-200", () => {
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&limit=0"))).toHaveProperty("error");
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&limit=201"))).toHaveProperty("error");
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&limit=50"))).toEqual(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("parses range 90d and rejects bad range", () => {
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&range=90d"))).toEqual(
      expect.objectContaining({ range: "90d" }),
    );
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&range=bad"))).toHaveProperty("error");
  });

  it("parses scope friends and rejects bad scope (UR A.17)", () => {
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&scope=friends"))).toEqual(
      expect.objectContaining({ scope: "friends" }),
    );
    expect(parsePinsParams(new URLSearchParams("bbox=113,22,114,23&scope=everyone"))).toHaveProperty("error");
  });
});

describe("toPinJson", () => {
  it("maps row and fuzzes coordinates, computes isOnline", () => {
    const now = Date.parse("2026-09-15T12:00:00Z");
    const row = {
      id: "pin-1",
      lat: 22.27889,
      lng: 114.18299,
      place_name: "銅鑼灣",
      created_at: "2026-09-15T11:55:00Z",
      users: { nickname: "阿怡", avatar_url: null, gender: "female", dob: "2000-01-01", last_seen_at: "2026-09-15T11:58:00Z" },
      beers: { name: "Asahi 生啤", emoji: "🍻" },
      photo_thumb: "data:image/jpeg;base64,/9j/",
      note: "今晚好開心🍻",
    };
    const pin = toPinJson(row, now);
    expect(pin).not.toBeNull();
    expect(pin?.lat).toBe(22.278);
    expect(pin?.lng).toBe(114.182);
    expect(pin?.area).toBe("銅鑼灣");
    expect(pin?.isOnline).toBe(true);
    expect(pin?.checkedInAt).toBe(Date.parse("2026-09-15T11:55:00Z"));
    expect(pin?.authorDob).toBe("2000-01-01");
    expect(pin?.authorBio).toBeNull();
    expect(pin?.photoThumb).toBe("data:image/jpeg;base64,/9j/");
    expect(pin?.note).toBe("今晚好開心🍻");
  });

  it("UR E.20 縮圖壞形即 null 不炸行（非 data:image／超長／缺席）", () => {
    const base = {
      id: "x",
      lat: 22.27889,
      lng: 114.18299,
      place_name: null,
      created_at: "2026-09-15T11:55:00Z",
      users: null,
      beers: null,
    };
    expect(toPinJson({ ...base, photo_thumb: "javascript:alert(1)" })?.photoThumb).toBeNull();
    expect(toPinJson({ ...base, photo_thumb: `data:image/jpeg;base64,${"a".repeat(40000)}` })?.photoThumb).toBeNull();
    expect(toPinJson({ ...base })?.photoThumb).toBeNull();
  });

  it("快貼 kind＋expiresAt 透传（iOS 剩餘时间用；post 无 expiresAt）", () => {
    const base = {
      id: "x",
      lat: 22.27889,
      lng: 114.18299,
      place_name: null,
      created_at: "2026-09-15T11:55:00Z",
      users: null,
      beers: null,
    };
    const flash = toPinJson({ ...base, kind: "flash", expires_at: "2026-09-16T11:55:00Z" });
    expect(flash?.kind).toBe("flash");
    expect(flash?.expiresAt).toBe("2026-09-16T11:55:00Z");
    const post = toPinJson({ ...base, kind: "post", expires_at: null });
    expect(post?.kind).toBe("post");
    expect(post?.expiresAt).toBeNull();
  });

  it("kind／expiresAt 壞形／缺席回 null 整行不炸", () => {
    const base = {
      id: "x",
      lat: 22.27889,
      lng: 114.18299,
      place_name: null,
      created_at: "2026-09-15T11:55:00Z",
      users: null,
      beers: null,
    };
    expect(toPinJson({ ...base, kind: "story", expires_at: "昨天" })?.kind).toBeNull();
    expect(toPinJson({ ...base, kind: "story", expires_at: "昨天" })?.expiresAt).toBeNull();
    const bare = toPinJson({ ...base });
    expect(bare?.kind).toBeNull();
    expect(bare?.expiresAt).toBeNull();
    expect(bare?.id).toBe("x");
  });

  it("iOS 走馬燈 note 原文透传，空串／空白／非字符串／缺席即 null", () => {
    const base = {
      id: "x",
      lat: 22.27889,
      lng: 114.18299,
      place_name: null,
      created_at: "2026-09-15T11:55:00Z",
      users: null,
      beers: null,
    };
    expect(toPinJson({ ...base, note: "今晚好開心🍻" })?.note).toBe("今晚好開心🍻");
    expect(toPinJson({ ...base, note: "" })?.note).toBeNull();
    expect(toPinJson({ ...base, note: "   " })?.note).toBeNull();
    expect(toPinJson({ ...base, note: 123 })?.note).toBeNull();
    expect(toPinJson({ ...base })?.note).toBeNull();
  });

  it("returns null on bad id/lat/created_at", () => {
    expect(toPinJson({ id: null, lat: 22, lng: 114, created_at: "2026-09-15T12:00:00Z" })).toBeNull();
    expect(toPinJson({ id: "x", lat: null, lng: 114, created_at: "2026-09-15T12:00:00Z" })).toBeNull();
    expect(toPinJson({ id: "x", lat: 22, lng: 114, created_at: "bad" })).toBeNull();
  });

  it("handles deleted user (users null) gracefully", () => {
    const row = {
      id: "pin-2",
      lat: 22.3,
      lng: 114.17,
      place_name: null,
      created_at: "2026-09-15T10:00:00Z",
      users: null,
      beers: null,
    };
    const pin = toPinJson(row, Date.now());
    expect(pin?.nickname).toBeNull();
    expect(pin?.isOnline).toBe(false);
  });
});

describe("isBboxOverlapsHK", () => {
  it("detects overlap and disjoint", () => {
    expect(isBboxOverlapsHK({ west: 113.8, south: 22.15, east: 114.44, north: 22.58 })).toBe(true);
    expect(isBboxOverlapsHK({ west: 0, south: 0, east: 1, north: 1 })).toBe(false);
  });
});

describe("parseSince／capCount", () => {
  it("缺席／非法拒；过老钳窗；future 透传", () => {
    const NOW = 1_000_000_000;
    const RANGE = 7 * 24 * 3600_000;
    expect(parseSince(null, NOW, RANGE)).toHaveProperty("error");
    expect(parseSince("abc", NOW, RANGE)).toHaveProperty("error");
    expect(parseSince("-5", NOW, RANGE)).toHaveProperty("error");
    expect(parseSince(String(NOW - RANGE - 1), NOW, RANGE)).toEqual({ sinceMs: NOW - RANGE });
    expect(parseSince(String(NOW - 1000), NOW, RANGE)).toEqual({ sinceMs: NOW - 1000 });
    expect(parseSince(String(NOW + 9999), NOW, RANGE)).toEqual({ sinceMs: NOW + 9999 });
  });
  it("99 封顶（100 行即 capped）", () => {
    expect(capCount(3)).toEqual({ count: 3, capped: false });
    expect(capCount(99)).toEqual({ count: 99, capped: false });
    expect(capCount(100)).toEqual({ count: 99, capped: true });
  });
});
