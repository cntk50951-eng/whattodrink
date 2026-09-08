import { describe, expect, it } from "vitest";

import {
  BEERS,
  BEER_CATEGORIES,
  beersInCategory,
  categoryOfBeer,
  pickRandomBeerIn,
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
