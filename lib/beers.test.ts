import { describe, expect, it } from "vitest";

import {
  BEERS,
  BEER_CATEGORIES,
  beersInCategory,
  categoryOfBeer,
  laneCardSize,
  pickRandomBatch,
  pickRandomBeerIn,
  pickSwapBatch,
} from "./beers";

describe("BEER_CATEGORIES mapping", () => {
  it("covers every BEERS.category exactly once (no orphan, no overlap)", () => {
    const all = BEER_CATEGORIES.flatMap((c) => c.match);
    expect(new Set(all).size).toBe(all.length);
    for (const beer of BEERS) {
      expect(all).toContain(beer.category);
    }
  });

  it("resolves every beer to its lane", () => {
    for (const beer of BEERS) {
      const lane = categoryOfBeer(beer);
      expect(lane).not.toBeNull();
      expect(lane?.match).toContain(beer.category);
    }
  });

  it("returns null for a beer with an unmapped category", () => {
    expect(
      categoryOfBeer({
        id: "x",
        emoji: "❓",
        name: "X",
        category: "mead",
        tagline: "",
      }),
    ).toBeNull();
  });
});

describe("beersInCategory", () => {
  it("returns only members of the lane", () => {
    const lane = BEER_CATEGORIES.find((c) => c.id === "beer");
    const got = beersInCategory("beer");
    expect(got.length).toBeGreaterThan(0);
    for (const beer of got) {
      expect(lane?.match).toContain(beer.category);
    }
  });

  it("returns [] for an unknown lane id", () => {
    expect(beersInCategory("nope")).toEqual([]);
  });
});

describe("pickRandomBeerIn", () => {
  it("picks deterministically with an injected rand", () => {
    const pool = beersInCategory("beer");
    expect(pickRandomBeerIn("beer", () => 0)).toBe(pool[0]);
    expect(pickRandomBeerIn("beer", () => 0.999)).toBe(
      pool[pool.length - 1],
    );
  });

  it("stays inside the lane (implicit top-up only yields lane members)", () => {
    for (let i = 0; i < 20; i++) {
      const pick = pickRandomBeerIn("whisky", () => i / 20);
      expect(pick).not.toBeNull();
      expect(["whisky", "highball"]).toContain(pick?.category);
    }
  });

  it("returns null for an unknown lane so callers fall back to global pick", () => {
    expect(pickRandomBeerIn("nope", () => 0)).toBeNull();
  });
});

describe("pickRandomBatch", () => {
  it("returns up to count, no duplicates, only lane members", () => {
    const batch = pickRandomBatch("beer", 6, () => 0.3);
    expect(batch.length).toBe(Math.min(6, beersInCategory("beer").length));
    expect(new Set(batch.map((b) => b.id)).size).toBe(batch.length);
    for (const b of batch) {
      expect(beersInCategory("beer").map((x) => x.id)).toContain(b.id);
    }
  });

  it("caps at pool size when the lane is smaller than count (single-item lane)", () => {
    expect(pickRandomBatch("red", 6, () => 0.5).length).toBe(1);
    expect(pickRandomBatch("sake", 6, () => 0.5).length).toBe(1);
  });

  it("falls back to the global pool for an unknown lane", () => {
    const batch = pickRandomBatch("nope", 6, () => 0.2);
    expect(batch.length).toBe(6);
    expect(batch.every((b) => BEERS.some((x) => x.id === b.id))).toBe(true);
  });

  it("is deterministic with an injected rand (shuffle)", () => {
    const a = pickRandomBatch("cocktail", 3, () => 0);
    const b = pickRandomBatch("cocktail", 3, () => 0);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it("does not mutate the source pool", () => {
    const before = beersInCategory("beer").map((b) => b.id);
    pickRandomBatch("beer", 6, () => 0.7);
    expect(beersInCategory("beer").map((b) => b.id)).toEqual(before);
  });
});

describe("laneCardSize", () => {
  it("scales with lane depth (deep lanes browse bigger)", () => {
    expect(laneCardSize(5)).toBe("lg");
    expect(laneCardSize(4)).toBe("lg");
    expect(laneCardSize(3)).toBe("md");
    expect(laneCardSize(2)).toBe("md");
    expect(laneCardSize(1)).toBe("sm");
    expect(laneCardSize(0)).toBe("sm");
  });

  it("covers the current catalog extremes", () => {
    const counts = BEER_CATEGORIES.map((c) => beersInCategory(c.id).length);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(4);
    expect(laneCardSize(Math.max(...counts))).toBe("lg");
    expect(laneCardSize(Math.min(...counts))).toBe("sm");
  });
});

describe("pickSwapBatch", () => {
  it("excludes the current beer and stays in-lane when possible", () => {
    const cur = beersInCategory("beer")[0] as (typeof BEERS)[number];
    const batch = pickSwapBatch(cur, 6, () => 0.4);
    expect(batch.map((b) => b.id)).not.toContain(cur.id);
    expect(new Set(batch.map((b) => b.id)).size).toBe(batch.length);
    for (const b of batch) {
      expect(beersInCategory("beer").map((x) => x.id)).toContain(b.id);
    }
  });

  it("falls back to global-minus-current for a single-item lane", () => {
    const cur = beersInCategory("red")[0] as (typeof BEERS)[number];
    const batch = pickSwapBatch(cur, 6, () => 0.4);
    expect(batch.length).toBeGreaterThan(0);
    expect(batch.map((b) => b.id)).not.toContain(cur.id);
  });
});
