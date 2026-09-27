import { describe, expect, it } from "vitest";

import { OSM_ATTRIBUTION, OSM_URL } from "../geo";
import {
  AMAP_TILE_URL,
  DEFAULT_MAP_PROVIDER,
  TILE_FALLBACK_THRESHOLD,
  parseMapProvider,
  shouldFallbackToOsm,
  tileSpecFor,
} from "./provider";

describe("parseMapProvider", () => {
  it("缺省回 osm（试水前行为）", () => {
    expect(parseMapProvider(undefined)).toBe("osm");
  });

  it("空串／非法回 osm", () => {
    expect(parseMapProvider("")).toBe("osm");
    expect(parseMapProvider("gaode")).toBe("osm");
    expect(parseMapProvider("OSM")).toBe("osm");
  });

  it("字面 amap 才切高德", () => {
    expect(parseMapProvider("amap")).toBe("amap");
  });

  it("缺省常数即 osm", () => {
    expect(DEFAULT_MAP_PROVIDER).toBe("osm");
  });
});

describe("tileSpecFor", () => {
  it("osm 沿用既有常数", () => {
    const spec = tileSpecFor("osm");
    expect(spec.url).toBe(OSM_URL);
    expect(spec.attribution).toBe(OSM_ATTRIBUTION);
    expect(spec.subdomains).toBeUndefined();
  });

  it("amap 模板含 xyz＋s 占位＋style=8＋中文", () => {
    expect(AMAP_TILE_URL).toContain("{x}");
    expect(AMAP_TILE_URL).toContain("{y}");
    expect(AMAP_TILE_URL).toContain("{z}");
    expect(AMAP_TILE_URL).toContain("{s}");
    expect(AMAP_TILE_URL).toContain("style=8");
    expect(AMAP_TILE_URL).toContain("lang=zh_cn");
    expect(AMAP_TILE_URL).toContain("autonavi.com");
    const spec = tileSpecFor("amap");
    expect(spec.url).toBe(AMAP_TILE_URL);
    expect(spec.subdomains).toEqual(["1", "2", "3", "4"]);
  });
});

describe("shouldFallbackToOsm", () => {
  it("未达阈值不回退", () => {
    expect(shouldFallbackToOsm(0)).toBe(false);
    expect(shouldFallbackToOsm(TILE_FALLBACK_THRESHOLD - 1)).toBe(false);
  });

  it("达阈值回退", () => {
    expect(shouldFallbackToOsm(TILE_FALLBACK_THRESHOLD)).toBe(true);
    expect(shouldFallbackToOsm(99)).toBe(true);
  });
});
