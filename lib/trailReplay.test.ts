import { describe, expect, it } from "vitest";
import { buildReplayStops, fuzzCoord, parseTrailVisibility, TRAIL_DELAY_MS, TRAIL_WINDOW_MS } from "./trailReplay";

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const iso = (agoMs: number) => new Date(NOW - agoMs).toISOString();
const H = 3600 * 1000;

describe("trailReplay", () => {
  it("parseTrailVisibility：只認 friends，其餘一律 off", () => {
    expect(parseTrailVisibility("friends")).toBe("friends");
    expect(parseTrailVisibility("public")).toBe("off");
    expect(parseTrailVisibility(null)).toBe("off");
  });
  it("fuzzCoord 取 3 位小數", () => {
    expect(fuzzCoord(22.281234)).toBe(22.281);
    expect(fuzzCoord(114.15567)).toBe(114.156);
  });
  it("過濾：私密／24 小時內／30 天外／無座標；升序；坐標模糊；不帶 id 與文字", () => {
    const rows = [
      { id: "a", visibility: "public", created_at: iso(48 * H), lat: 22.28123, lng: 114.15567, place_name: " 甲吧 ", beer_id: "b1", note: "秘密", photo_thumb: "x" },
      { id: "b", visibility: "friends", created_at: iso(72 * H), lat: 22.3, lng: 114.2, place_name: "", beer_id: null },
      { id: "c", visibility: "private", created_at: iso(48 * H), lat: 22.1, lng: 114.1 },
      { id: "d", visibility: "public", created_at: iso(TRAIL_DELAY_MS - H), lat: 22.1, lng: 114.1 },
      { id: "e", visibility: "public", created_at: iso(TRAIL_WINDOW_MS + H), lat: 22.1, lng: 114.1 },
      { id: "f", visibility: "public", created_at: iso(50 * H), lat: null, lng: null },
      { id: "g", visibility: "public", created_at: "bad", lat: 22, lng: 114 },
    ];
    const s = buildReplayStops(rows, new Map([["b1", "🍺"]]), NOW);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ at: iso(72 * H), lat: 22.3, lng: 114.2, place_name: null, emoji: null });
    expect(s[1]).toEqual({ at: iso(48 * H), lat: 22.281, lng: 114.156, place_name: "甲吧", emoji: "🍺" });
    expect(JSON.stringify(s)).not.toContain("秘密");
  });
});
