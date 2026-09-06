import { describe, expect, it, vi } from "vitest";

import {
  formatPlaceName,
  formatWantCoords,
  formatWantTime,
  parseWantRecord,
  resolvePlaceName,
} from "./wantRecord";

const GOOD = {
  beer: {
    id: "asahi",
    emoji: "🍻",
    name: "Asahi 生啤",
    category: "draft",
    tagline: "週五的快樂開場",
  },
  at: 1785628320000,
  position: { lat: 22.2819, lng: 114.1577 },
};

describe("parseWantRecord", () => {
  it("accepts a complete record", () => {
    expect(parseWantRecord(GOOD)).toEqual(GOOD);
  });

  it("rejects null, primitives, and garbage", () => {
    expect(parseWantRecord(null)).toBeNull();
    expect(parseWantRecord("nope")).toBeNull();
    expect(parseWantRecord({})).toBeNull();
  });

  it("rejects bad timestamps", () => {
    expect(parseWantRecord({ ...GOOD, at: -1 })).toBeNull();
    expect(parseWantRecord({ ...GOOD, at: NaN })).toBeNull();
    expect(parseWantRecord({ ...GOOD, at: "1785628320000" })).toBeNull();
  });

  it("rejects bad positions", () => {
    expect(
      parseWantRecord({ ...GOOD, position: { lat: 22.28 } }),
    ).toBeNull();
    expect(
      parseWantRecord({
        ...GOOD,
        position: { lat: NaN, lng: 114.15 },
      }),
    ).toBeNull();
  });

  it("rejects beers missing display fields", () => {
    expect(
      parseWantRecord({ ...GOOD, beer: { id: "x" } }),
    ).toBeNull();
  });

  it("fills optional beer fields with empty strings", () => {
    const record = parseWantRecord({
      ...GOOD,
      beer: { id: "x", emoji: "🍺", name: "X" },
    });
    expect(record?.beer.category).toBe("");
    expect(record?.beer.tagline).toBe("");
  });
});

describe("formatWantTime", () => {
  // 2026-09-05 14:32 HKT (06:32 UTC).
  const AT = Date.UTC(2026, 8, 5, 6, 32);

  it("formats English as YYYY-MM-DD HH:MM in HK wall-clock", () => {
    expect(formatWantTime(AT, "en")).toBe("2026-09-05 14:32");
  });

  it("formats Chinese as XXXX年XX月XX日 HH:MM in HK wall-clock", () => {
    expect(formatWantTime(AT, "zh-Hant")).toBe("2026年9月5日 14:32");
    expect(formatWantTime(AT, "zh-Hans")).toBe("2026年9月5日 14:32");
  });

  it("follows the viewer language, not the viewer zone", () => {
    // 06:32 UTC is a different calendar day behind HK; the HK date wins.
    expect(formatWantTime(Date.UTC(2026, 8, 5, 15, 5), "en")).toBe(
      "2026-09-05 23:05",
    );
  });
});

describe("formatWantCoords", () => {
  it("rounds to 4 decimals", () => {
    expect(
      formatWantCoords({ lat: 22.28194, lng: 114.15772 }),
    ).toBe("22.2819, 114.1577");
  });
});

describe("formatPlaceName", () => {
  it("joins road and district with a Chinese comma", () => {
    expect(
      formatPlaceName(
        {
          address: {
            road: "皇后大道中",
            suburb: "中環",
            city: "香港",
          },
        },
        "zh-Hant",
      ),
    ).toBe("皇后大道中，中環");
  });

  it("joins road and district with a Latin comma in English", () => {
    expect(
      formatPlaceName(
        {
          address: {
            road: "Queen's Road Central",
            suburb: "Central",
          },
        },
        "en",
      ),
    ).toBe("Queen's Road Central, Central");
  });

  it("uses whatever address part exists", () => {
    expect(
      formatPlaceName({ address: { city: "香港" } }, "zh-Hant"),
    ).toBe("香港");
  });

  it("falls back to the first display_name segment", () => {
    expect(
      formatPlaceName(
        { display_name: "維多利亞港, 香港" },
        "zh-Hant",
      ),
    ).toBe("維多利亞港");
  });

  it("returns null when there is nothing usable", () => {
    expect(formatPlaceName({}, "en")).toBeNull();
    expect(formatPlaceName({ display_name: "" }, "en")).toBeNull();
  });
});

describe("resolvePlaceName", () => {
  it("formats the fetched response and memoizes per position", async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          address: { road: "皇后大道中", suburb: "中環" },
        }),
      };
    };
    vi.stubGlobal("fetch", fetchMock);
    try {
      const position = { lat: 22.28191, lng: 114.15772 };
      await expect(resolvePlaceName(position, "zh-Hant")).resolves.toBe(
        "皇后大道中，中環",
      );
      await expect(resolvePlaceName(position, "zh-Hant")).resolves.toBe(
        "皇后大道中，中環",
      );
      expect(calls).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns null when the network fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    try {
      await expect(
        resolvePlaceName({ lat: 22.1, lng: 114.1 }, "en"),
      ).resolves.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
