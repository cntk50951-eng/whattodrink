import { describe, expect, it } from "vitest";

import {
  avoidLive,
  groupOverlaps,
  planSpread,
  vogelOffset,
} from "./mapSpread";

describe("vogelOffset", () => {
  it("第一環半徑＝base×√2，確定性（同 k 同值）", () => {
    const a = vogelOffset(1, 30);
    const b = vogelOffset(1, 30);
    expect(a).toEqual(b);
    expect(Math.hypot(a.dx, a.dy)).toBeCloseTo(30 * Math.SQRT2, 6);
  });
  it("環半徑隨 k 單調增（外疏內密不重打）", () => {
    const rs = [1, 2, 3, 4, 5].map((k) =>
      Math.hypot(...(() => {
        const o = vogelOffset(k, 30);
        return [o.dx, o.dy] as const;
      })()),
    );
    for (let i = 1; i < rs.length; i += 1) {
      expect((rs[i] as number) > (rs[i - 1] as number)).toBe(true);
    }
  });
});

describe("groupOverlaps", () => {
  it("單枚／遠距不成組；傳遞相連成一組", () => {
    expect(groupOverlaps([{ id: "a", x: 0, y: 0 }], 48)).toEqual([[0]]);
    const gs = groupOverlaps(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 30, y: 0 },
        { id: "c", x: 60, y: 0 },
        { id: "far", x: 500, y: 500 },
      ],
      48,
    );
    // a-b、b-c 相連 → 傳遞成 {a,b,c}，far 獨立
    expect(gs.map((g) => g.length).sort()).toEqual([1, 3]);
  });
});

describe("planSpread", () => {
  it("無碰撞快道：全零偏移、零堆疊", () => {
    const plan = planSpread(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 500, y: 500 },
      ],
      { thresholdPx: 48, basePx: 30, cap: 6 },
    );
    expect(plan.offsets.get("a")).toEqual({ dx: 0, dy: 0 });
    expect(plan.offsets.get("b")).toEqual({ dx: 0, dy: 0 });
    expect(plan.stacks).toEqual([]);
  });
  it("小組：首枚（id 序）留真位，其餘螺旋散開", () => {
    const plan = planSpread(
      [
        { id: "c", x: 10, y: 0 },
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 20, y: 0 },
      ],
      { thresholdPx: 48, basePx: 30, cap: 6 },
    );
    expect(plan.offsets.get("a")).toEqual({ dx: 0, dy: 0 });
    expect(Math.hypot(...(() => {
      const o = plan.offsets.get("b") as { dx: number; dy: number };
      return [o.dx, o.dy] as const;
    })())).toBeGreaterThan(40);
    expect(plan.stacks).toEqual([]);
  });
  it("超 cap：首枚留守＋其餘收堆疊（不硬散）", () => {
    const pts = Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      x: i * 5,
      y: 0,
    }));
    const plan = planSpread(pts, { thresholdPx: 48, basePx: 30, cap: 6 });
    expect(plan.stacks).toHaveLength(1);
    expect(plan.stacks[0]?.keeperId).toBe("m0");
    expect(plan.stacks[0]?.memberIds).toHaveLength(7);
  });
  it("快照：固定 8 點混合案（防螺旋／分組回退）", () => {
    const plan = planSpread(
      [
        { id: "solo", x: 900, y: 900 },
        { id: "s1", x: 100, y: 100 },
        { id: "s2", x: 110, y: 105 },
        { id: "s3", x: 95, y: 112 },
        { id: "t1", x: 400, y: 400 },
        { id: "t2", x: 405, y: 402 },
        { id: "t3", x: 398, y: 407 },
        { id: "t4", x: 410, y: 398 },
      ],
      { thresholdPx: 48, basePx: 30, cap: 6 },
    );
    expect({
      offsets: [...plan.offsets.entries()],
      stacks: plan.stacks,
    }).toMatchSnapshot();
  });
});

describe("avoidLive", () => {
  it("無 live 即空；圈外不推", () => {
    expect(avoidLive([{ id: "a", x: 0, y: 0 }], [], 40)).toEqual(new Map());
    expect(
      avoidLive([{ id: "a", x: 200, y: 200 }], [{ x: 0, y: 0 }], 40),
    ).toEqual(new Map());
  });
  it("圈內沿徑向推出到 min＋pad；同像素沿＋x", () => {
    const out = avoidLive(
      [
        { id: "near", x: 10, y: 0 },
        { id: "same", x: 0, y: 0 },
      ],
      [{ x: 0, y: 0 }],
      40,
    );
    const near = out.get("near") as { dx: number; dy: number };
    expect(near.dx).toBeCloseTo(36, 6);
    expect(near.dy).toBeCloseTo(0, 6);
    const same = out.get("same") as { dx: number; dy: number };
    expect(same.dx).toBeCloseTo(46, 6);
  });
});
