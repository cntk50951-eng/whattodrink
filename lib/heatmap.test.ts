import { describe, expect, it } from "vitest";

import { HEAT_WINDOW_MS, groupHeatCells, orderHeatCellsTour, summarizeHeatCell, connectedCellIds } from "./heatmap";
import type { HeatCell } from "./heatmap";

const NOW = 1_780_000_000_000;

function pt(id: string, lat: number, lng: number, ageH: number): { id: string; lat: number; lng: number; at: number } {
  return { id, lat, lng, at: NOW - ageH * 3600_000 };
}

describe("groupHeatCells (UR E.6)", () => {
  it("空输入回空；脏行（空 id／NaN／未来／过期）丢弃", () => {
    expect(groupHeatCells([], NOW)).toEqual([]);
    expect(
      groupHeatCells(
        [
          { id: "", lat: 22.28, lng: 114.15, at: NOW },
          { id: "x", lat: NaN, lng: 114.15, at: NOW },
          { id: "y", lat: 22.28, lng: 114.15, at: NOW + 1 },
          { id: "z", lat: 22.28, lng: 114.15, at: NOW - HEAT_WINDOW_MS - 1 },
          { id: "w", lat: 22.28, lng: 114.15, at: null },
        ],
        NOW,
      ),
    ).toEqual([]);
  });
  it("同格收拢（成员 id 排序）＋1km 外分格", () => {
    const cells = groupHeatCells(
      [pt("b", 22.281, 114.151, 1), pt("a", 22.28, 114.15, 2), pt("c", 22.38, 114.19, 1)],
      NOW,
    );
    expect(cells).toHaveLength(2);
    expect(cells[0]?.ids).toEqual(["a", "b"]);
    expect(cells[1]?.ids).toEqual(["c"]);
  });
  it("同 id 去重", () => {
    const cells = groupHeatCells([pt("a", 22.28, 114.15, 1), pt("a", 22.281, 114.151, 2)], NOW);
    expect(cells).toHaveLength(1);
    expect(cells[0]?.ids).toEqual(["a"]);
  });
});

describe("orderHeatCellsTour (UR E.6 round-4)", () => {
  it("起点离我最近，之后基于当前格跳最近未访格", () => {
    const cells = [
      { key: "far", lat: 22.5, lng: 114.3, ids: ["c"] },
      { key: "mid", lat: 22.32, lng: 114.18, ids: ["b"] },
      { key: "near", lat: 22.29, lng: 114.16, ids: ["a"] },
    ];
    const ordered = orderHeatCellsTour(cells, { lat: 22.28, lng: 114.15 });
    expect(ordered.map((c) => c.key)).toEqual(["near", "mid", "far"]);
  });
  it("origin 为 null 原样返回；单格原样返回", () => {
    const cells = [
      { key: "a", lat: 22.28, lng: 114.15, ids: ["x"] },
      { key: "b", lat: 22.3, lng: 114.17, ids: ["y"] },
    ];
    expect(orderHeatCellsTour(cells, null).map((c) => c.key)).toEqual(["a", "b"]);
    expect(
      orderHeatCellsTour([cells[0] as { key: string; lat: number; lng: number; ids: string[] }], {
        lat: 0,
        lng: 0,
      }),
    ).toHaveLength(1);
  });
});

describe("summarizeHeatCell (UR E.6 round-5)", () => {
  const cell = { key: "k", lat: 22.3, lng: 114.16, ids: ["a", "b", "c"] };
  it("地点取众数＋计数＋距离", () => {
    const s = summarizeHeatCell(
      cell,
      [
        { id: "a", area: "旺角" },
        { id: "b", area: "旺角" },
        { id: "c", area: "油麻地" },
      ],
      { lat: 22.28, lng: 114.15 },
    );
    expect(s.area).toBe("旺角");
    expect(s.count).toBe(3);
    expect(s.distanceM).toBeGreaterThan(0);
  });
  it("平票先到先得；全未知回 null；无定位距离 null", () => {
    const tie = summarizeHeatCell(
      cell,
      [
        { id: "a", area: "旺角" },
        { id: "b", area: "油麻地" },
        { id: "c", area: null },
      ],
      { lat: 22.28, lng: 114.15 },
    );
    expect(tie.area).toBe("旺角");
    const unknown = summarizeHeatCell(
      cell,
      [
        { id: "a", area: null },
        { id: "b", area: "  " },
      ],
      null,
    );
    expect(unknown.area).toBeNull();
    expect(unknown.count).toBe(3);
    expect(unknown.distanceM).toBeNull();
  });
});

describe("connectedCellIds (UR E.6 round-7)", () => {
  const mk = (cx: number, cy: number, ids: string[]): HeatCell => ({
    key: `${cx}:${cy}`,
    lat: cx * 0.009,
    lng: cy * 0.01,
    ids,
  });
  it("八邻接连通全并入（含对角＋传递）", () => {
    const cells = [
      mk(0, 0, ["a"]),
      mk(1, 0, ["b"]),
      mk(1, 1, ["c"]),
      mk(5, 5, ["far"]),
    ];
    expect(connectedCellIds(cells[0] as HeatCell, cells)).toEqual(["a", "b", "c"]);
    expect(connectedCellIds(cells[3] as HeatCell, cells)).toEqual(["far"]);
  });
  it("孤立格退化为本格", () => {
    const cells = [mk(0, 0, ["a", "b"])];
    expect(connectedCellIds(cells[0] as HeatCell, cells)).toEqual(["a", "b"]);
  });
});
