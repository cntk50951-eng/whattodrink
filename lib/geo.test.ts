import { describe, expect, it } from "vitest";

import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  ZOOM_DEFAULT,
  ZOOM_HK_WIDE,
  ZOOM_MAX,
  ZOOM_MIN,
  isWithinHongKong,
} from "./geo";

describe("isWithinHongKong", () => {
  it("accepts Central and Causeway Bay", () => {
    expect(isWithinHongKong({ lat: 22.2819, lng: 114.1577 })).toBe(true);
    expect(isWithinHongKong({ lat: 22.2783, lng: 114.1827 })).toBe(true);
  });

  it("accepts the bounding-box corners (inclusive)", () => {
    expect(
      isWithinHongKong({ lat: HK_BOUNDS.south, lng: HK_BOUNDS.west }),
    ).toBe(true);
    expect(
      isWithinHongKong({ lat: HK_BOUNDS.north, lng: HK_BOUNDS.east }),
    ).toBe(true);
  });

  it("rejects Taipei and Macau", () => {
    expect(isWithinHongKong({ lat: 25.033, lng: 121.5654 })).toBe(false);
    expect(isWithinHongKong({ lat: 22.1987, lng: 113.5439 })).toBe(false);
  });
});

describe("geo constants", () => {
  it("keeps the fallback centre inside Hong Kong", () => {
    expect(isWithinHongKong(DEFAULT_CENTER)).toBe(true);
  });

  it("orders zooms min <= hk-wide <= default <= max", () => {
    expect(ZOOM_MIN).toBeLessThanOrEqual(ZOOM_HK_WIDE);
    expect(ZOOM_HK_WIDE).toBeLessThanOrEqual(ZOOM_DEFAULT);
    expect(ZOOM_DEFAULT).toBeLessThanOrEqual(ZOOM_MAX);
  });
});
