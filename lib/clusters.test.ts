import { describe, expect, it } from "vitest";

import { clusterPoints } from "./clusters";

describe("clusterPoints (UR2.8)", () => {
  it("returns one cluster per point when all far apart", () => {
    const out = clusterPoints(
      [
        { x: 0, y: 0 },
        { x: 500, y: 500 },
      ],
      60,
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.members).toEqual([0]);
    expect(out[1]?.members).toEqual([1]);
  });

  it("merges points within the radius and reports the centroid", () => {
    const out = clusterPoints(
      [
        { x: 0, y: 0 },
        { x: 30, y: 40 }, // 距 50 <= 60，同簇
      ],
      60,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.members).toEqual([0, 1]);
    expect(out[0]?.centroid).toEqual({ x: 15, y: 20 });
  });

  it("keeps input order stable (first cluster wins the borderline point)", () => {
    const out = clusterPoints(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 100, y: 0 }, // 距两簇都是 100，半径 100 并入第一簇
      ],
      100,
    );
    expect(out).toHaveLength(2);
    expect(out[0]?.members).toEqual([0, 2]);
    expect(out[1]?.members).toEqual([1]);
  });

  it("handles empty and single-point input", () => {
    expect(clusterPoints([], 60)).toEqual([]);
    const [only] = clusterPoints([{ x: 7, y: 9 }], 60);
    expect(only?.members).toEqual([0]);
    expect(only?.centroid).toEqual({ x: 7, y: 9 });
  });
});
