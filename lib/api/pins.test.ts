import { describe, expect, it } from "vitest";

import {
  fuzzCoordinate,
  isBboxOverlapsHK,
  parseBbox,
  parsePinsParams,
  parseRange,
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
      users: { nickname: "阿怡", avatar_url: null, gender: "female", last_seen_at: "2026-09-15T11:58:00Z" },
      beers: { name: "Asahi 生啤", emoji: "🍻" },
    };
    const pin = toPinJson(row, now);
    expect(pin).not.toBeNull();
    expect(pin?.lat).toBe(22.278);
    expect(pin?.lng).toBe(114.182);
    expect(pin?.area).toBe("銅鑼灣");
    expect(pin?.isOnline).toBe(true);
    expect(pin?.checkedInAt).toBe(Date.parse("2026-09-15T11:55:00Z"));
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
