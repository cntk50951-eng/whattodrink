import { describe, expect, it } from "vitest";

import { addPinned, findPinned, parsePinnedList, removePinned, type PinnedPlace } from "./pinnedPlaces";

const p = (id: string, lat: number, lng: number): PinnedPlace => ({
  id,
  name: id,
  lat,
  lng,
  createdAt: 1,
  sourceCheckinId: null,
});

describe("pinnedPlaces", () => {
  it("10m 內視為同一處", () => {
    expect(findPinned([p("a", 22.3, 114.1)], 22.30005, 114.10005)?.id).toBe("a");
    expect(findPinned([p("a", 22.3, 114.1)], 22.31, 114.1)).toBeNull();
  });
  it("加入去重＋新在前＋刪", () => {
    const l1 = addPinned(p("a", 22.3, 114.1), []);
    const l2 = addPinned(p("b", 22.4, 114.2), l1);
    expect(l2.map((x) => x.id)).toEqual(["b", "a"]);
    expect(addPinned(p("c", 22.30005, 114.10005), l2)).toBe(l2);
    expect(removePinned("b", l2).map((x) => x.id)).toEqual(["a"]);
  });
  it("壞條過濾", () => {
    expect(parsePinnedList("nope")).toEqual([]);
    expect(parsePinnedList([{ id: "a", name: "A", lat: 22.3, lng: 114.1, createdAt: 1 }, { bad: 1 }]).map((x) => x.id)).toEqual(["a"]);
  });
});
