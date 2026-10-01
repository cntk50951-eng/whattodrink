import { describe, expect, it } from "vitest";

import { pickRandomIndex } from "./reveal";

describe("pickRandomIndex", () => {
  it("returns -1 for an empty pool (caller keeps the overlay closed)", () => {
    expect(pickRandomIndex(0)).toBe(-1);
    expect(pickRandomIndex(-3)).toBe(-1);
  });

  it("maps rand=0 to the first photo", () => {
    expect(pickRandomIndex(5, () => 0)).toBe(0);
  });

  it("maps rand just under 1 to the last photo (never out of bounds)", () => {
    expect(pickRandomIndex(5, () => 0.999)).toBe(4);
    expect(pickRandomIndex(5, () => 0.999999)).toBe(4);
  });

  it("always returns 0 for a single-photo pool", () => {
    expect(pickRandomIndex(1, () => 0)).toBe(0);
    expect(pickRandomIndex(1, () => 0.5)).toBe(0);
    expect(pickRandomIndex(1, () => 0.999)).toBe(0);
  });

  it("scales across the pool", () => {
    expect(pickRandomIndex(4, () => 0.25)).toBe(1);
    expect(pickRandomIndex(4, () => 0.5)).toBe(2);
    expect(pickRandomIndex(4, () => 0.75)).toBe(3);
  });
});
