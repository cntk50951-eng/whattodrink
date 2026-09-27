import { describe, expect, it } from "vitest";

import {
  interpolateFootprints,
  parseTrailResume,
  readTrailFlag,
  STOPS_OPEN_KEY,
  TRAIL_ON_KEY,
  trailStops,
  writeTrailFlag,
} from "./trail";

const RECORD = {
  beer: { id: "asahi", emoji: "🍺", name: "Asahi", category: "lager", tagline: "t" },
  at: 1_700_000_000_000,
  position: { lat: 22.28, lng: 114.15 },
  placeName: "中環",
};

describe("trailStops (UR3.4)", () => {
  it("returns no stops without my own check-ins (never invents)", () => {
    expect(trailStops([])).toEqual([]);
  });

  it("turns my want history into ordered stops", () => {
    const older = { ...RECORD, at: RECORD.at - 1000 };
    const stops = trailStops([RECORD, older]);
    expect(stops).toHaveLength(2);
    expect(stops[0]?.beerId).toBe("asahi");
    expect(stops[1]?.beerName).toBe("Asahi");
    expect(stops[0]?.at).toBeLessThan(stops[1]?.at ?? 0);
  });
});

describe("parseTrailResume (C.11)", () => {
  it("只有 trail=1 續跑", () => {
    expect(parseTrailResume("?trail=1")).toBe(true);
    expect(parseTrailResume("trail=1")).toBe(true);
    expect(parseTrailResume("?a=1&trail=1")).toBe(true);
  });

  it("空／缺／非 1 不續跑", () => {
    expect(parseTrailResume("")).toBe(false);
    expect(parseTrailResume(null)).toBe(false);
    expect(parseTrailResume(undefined)).toBe(false);
    expect(parseTrailResume("?trail=0")).toBe(false);
    expect(parseTrailResume("?pick=1")).toBe(false);
  });
});

describe("interpolateFootprints (C.11 round-6)", () => {
  it("兩站之間插腳印（順序＋朝東約 90°＋點在線段上）", () => {
    const steps = interpolateFootprints(
      [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
      ],
      2,
    );
    expect(steps).toHaveLength(2);
    expect(steps[0]?.angle).toBeCloseTo(90);
    expect(steps[0]?.step).toBe(0);
    expect(steps[1]?.step).toBe(1);
    expect(steps[0]?.lng ?? 0).toBeGreaterThan(0);
    expect(steps[0]?.lng ?? 1).toBeLessThan(0.001);
  });

  it("空／單站／非法參數回空", () => {
    expect(interpolateFootprints([])).toEqual([]);
    expect(interpolateFootprints([{ lat: 0, lng: 0 }])).toEqual([]);
    expect(
      interpolateFootprints(
        [
          { lat: 0, lng: 0 },
          { lat: 0, lng: 0.001 },
        ],
        0,
      ),
    ).toEqual([]);
  });

  it("跨洋腿不断（round-12 訂正：HK→美國照畫，旅程不斷線）", () => {
    const steps = interpolateFootprints(
      [
        { lat: 22.28, lng: 114.15 },
        { lat: 40.7, lng: -74 },
      ],
      4,
    );
    expect(steps.length).toBeGreaterThan(0);
  });

  it("總量 cap 封頂", () => {
    const stops = Array.from({ length: 10 }, (_, i) => ({
      lat: i * 0.001,
      lng: 0,
    }));
    expect(interpolateFootprints(stops, 4, 5)).toHaveLength(5);
  });
});

describe("trail flags (C.11 round-8)", () => {
  it("key 常數穩定（會話鍵改名即全鏈改）", () => {
    expect(TRAIL_ON_KEY).toBe("wtd-trail-on");
    expect(STOPS_OPEN_KEY).toBe("wtd-stops-open");
  });

  it("無 window 回 false／寫入不拋（node 環境即此分支）", () => {
    expect(readTrailFlag(TRAIL_ON_KEY)).toBe(false);
    expect(() => writeTrailFlag(TRAIL_ON_KEY, true)).not.toThrow();
    expect(() => writeTrailFlag(STOPS_OPEN_KEY, false)).not.toThrow();
  });
});
