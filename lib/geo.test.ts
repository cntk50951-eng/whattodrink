import { describe, expect, it } from "vitest";

import {
  DEFAULT_CENTER,
  HK_BOUNDS,
  OSM_ATTRIBUTION,
  OSM_URL,
  STADIA_ATTRIBUTION,
  ZOOM_DEFAULT,
  ZOOM_HK_WIDE,
  ZOOM_MAX,
  ZOOM_MIN,
  gcj02ToWgs84,
  wgs84ToGcj02,
  formatDistance,
  haversineMeters,
  initialBearing,
  isWithinHongKong,
  stadiaTileUrl,
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

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(
      haversineMeters({ lat: 22.2819, lng: 114.1577 }, { lat: 22.2819, lng: 114.1577 }),
    ).toBe(0);
  });

  it("measures one equatorial degree of longitude as ~111.2 km", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      111195,
      0,
    );
  });

  it("puts Central-to-TST in a sane walking-plus-harbour range", () => {
    const d = haversineMeters(
      { lat: 22.2819, lng: 114.1577 },
      { lat: 22.2976, lng: 114.1722 },
    );
    expect(d).toBeGreaterThan(2000);
    expect(d).toBeLessThan(2600);
  });
});

describe("formatDistance", () => {
  it("shows metres below 1 km", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(350.4)).toBe("350 m");
  });

  it("shows kilometres at/above 1 km with one decimal", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(2296)).toBe("2.3 km");
  });

  it("falls back to a dash for garbage input", () => {
    expect(formatDistance(NaN)).toBe("—");
    expect(formatDistance(-5)).toBe("—");
  });
});

describe("tile providers", () => {
  it("builds the Stadia watercolor URL with the key as a query param", () => {
    const url = stadiaTileUrl("test-key-123");
    expect(url).toContain("tiles.stadiamaps.com/tiles/stamen_watercolor/");
    expect(url).toContain("{z}/{x}/{y}");
    expect(url).toContain("api_key=test-key-123");
  });

  it("keeps attributions non-empty (legally required on-map credit)", () => {
    expect(OSM_URL).toContain("tile.openstreetmap.org");
    expect(OSM_ATTRIBUTION).toContain("OpenStreetMap");
    expect(STADIA_ATTRIBUTION).toContain("Stadia Maps");
    expect(STADIA_ATTRIBUTION).toContain("Stamen Design");
  });
});

describe("gcj02ToWgs84", () => {
  it("往返误差米级（中环点）", () => {
    const wgs = { lat: 22.2819, lng: 114.1577 };
    const back = gcj02ToWgs84(wgs84ToGcj02(wgs));
    expect(haversineMeters(back, wgs)).toBeLessThan(5);
  });
  it("境外点恒等（零偏移）", () => {
    const p = { lat: 35.68, lng: 139.69 };
    expect(gcj02ToWgs84(p)).toEqual(p);
  });
  it("香港偏移量级合理（数十至数百米，非零非离谱）", () => {
    const wgs = { lat: 22.2819, lng: 114.1577 };
    const d = haversineMeters(gcj02ToWgs84(wgs), wgs);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(2000);
  });
});

describe("initialBearing", () => {
  it("正北 0／正东 90／正南 180／正西 270", () => {
    const o = { lat: 22.28, lng: 114.15 };
    expect(initialBearing(o, { lat: 22.29, lng: 114.15 })).toBeCloseTo(0, 0);
    expect(initialBearing(o, { lat: 22.28, lng: 114.16 })).toBeCloseTo(90, 0);
    expect(initialBearing(o, { lat: 22.27, lng: 114.15 })).toBeCloseTo(180, 0);
    expect(initialBearing(o, { lat: 22.28, lng: 114.14 })).toBeCloseTo(270, 0);
  });
});
