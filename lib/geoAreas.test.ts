import { describe, expect, it } from "vitest";

import {
  ANCHOR_ZOOM_MAX,
  AREA_ANCHORS,
  areaOf,
  groupByAnchor,
} from "./geoAreas";

describe("areaOf (UR C.9)", () => {
  it("地標點歸屬正確商圈", () => {
    expect(areaOf(22.2819, 114.158)?.id).toBe("central");
    expect(areaOf(22.295, 114.1694)?.id).toBe("tst");
    expect(areaOf(22.2783, 114.1827)?.id).toBe("causeway-bay");
    expect(areaOf(22.445, 114.022)?.id).toBe("yuen-long");
  });

  it("錨表 city／country 全填（國家層模型預留）", () => {
    expect(AREA_ANCHORS.length).toBeGreaterThan(0);
    for (const a of AREA_ANCHORS) {
      expect(a.city).toBe("香港");
      expect(a.country).toBe("中國");
    }
  });

  it("錨 id 唯一", () => {
    const ids = AREA_ANCHORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("groupByAnchor (UR C.9)", () => {
  it("同商圈收一組，異商圈分組（首見順出組）", () => {
    const groups = groupByAnchor([
      { lat: 22.282, lng: 114.158 },
      { lat: 22.2951, lng: 114.1695 },
      { lat: 22.2821, lng: 114.1581 },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.anchor.id).toBe("central");
    expect(groups[0]?.members).toEqual([0, 2]);
    expect(groups[1]?.anchor.id).toBe("tst");
    expect(groups[1]?.members).toEqual([1]);
  });

  it("空輸入回空數組", () => {
    expect(groupByAnchor([])).toEqual([]);
  });

  it("錨分流閾值與 zoom 常數對齊（z≤11 按錨）", () => {
    expect(ANCHOR_ZOOM_MAX).toBe(11);
  });
});
