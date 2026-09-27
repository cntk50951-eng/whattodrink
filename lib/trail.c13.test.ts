import { describe, it, expect } from "vitest";
import { footprintsByArea, interpolateFootprints, type TrailStop } from "./trail";

function mk(id: string, lat: number, lng: number, at: number): TrailStop {
  return {
    id,
    beerId: "test",
    beerName: "test",
    at,
    position: { lat, lng },
    placeName: "",
  };
}

describe("footprintsByArea (UR C.13)", () => {
  it("空/单点回空", () => {
    expect(footprintsByArea([])).toEqual([]);
    expect(footprintsByArea([mk("a", 22.2819, 114.158, 1000)])).toEqual([]);
  });

  it("同区两点按 at 旧→新插 2 枚（减少数量）", () => {
    const a = mk("a", 22.2819, 114.158, 1000);
    const b = mk("b", 22.2825, 114.159, 2000);
    const out = footprintsByArea([b, a]);
    expect(out.length).toBe(2);
    expect(out[0]?.step).toBe(0);
    expect(out[0]?.angle).toBeCloseTo(
      (Math.atan2(b.position.lng - a.position.lng, b.position.lat - a.position.lat) * 180) / Math.PI,
    );
  });

  it("跨区仅跨区段有脚印（深圳香港）", () => {
    const hk = mk("a", 22.2819, 114.158, 1000);
    const sz = mk("b", 22.543, 114.057, 2000);
    const hk2 = mk("c", 22.2825, 114.159, 3000);
    const sz2 = mk("d", 22.55, 114.06, 4000);
    // 序列 hk -> sz -> hk -> sz，跨区段 3 段，各 2 枚 =6
    const out = footprintsByArea([hk, sz, hk2, sz2]);
    expect(out.length).toBe(6);
  });

  it("总量 cap 封顶", () => {
    const stops: TrailStop[] = [];
    for (let i = 0; i < 10; i++) {
      stops.push(mk(`p${i}`, 22.2819 + i * 0.0005, 114.158 + i * 0.0005, 1000 + i * 1000));
    }
    const out = footprintsByArea(stops, 4, 48);
    expect(out.length).toBeLessThanOrEqual(48);
  });

  it("hk 外多点跨区（北京）", () => {
    const hkA = mk("a", 22.2819, 114.158, 1000);
    const hkB = mk("b", 22.2825, 114.159, 2000);
    const far = mk("c", 39.9, 116.4, 3000);
    const out = footprintsByArea([hkA, hkB, far]);
    // hkA->hkB 同城不插，hkB->bj 跨国插 2 枚
    expect(out.length).toBe(2);
  });

  it("单点区域跨区 2 点插 2 枚", () => {
    const central = mk("a", 22.2819, 114.158, 1000);
    const mkSingle = mk("b", 22.3193, 114.1694, 2000);
    const out = footprintsByArea([central, mkSingle]);
    // 2 点不同锚，跨区段 1 段 2 枚
    expect(out.length).toBe(2);
  });
});

describe("interpolateFootprints still works", () => {
  it("基础", () => {
    const out = interpolateFootprints([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }], 2, 10);
    expect(out.length).toBe(2);
  });
});
