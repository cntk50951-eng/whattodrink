import { describe, expect, it } from "vitest";

import { apiPinsToMarkers, mockToMarkers } from "./v2Pins";

describe("apiPinsToMarkers (UR C.1)", () => {
  it("映射 id／座標／首字／在線", () => {
    const out = apiPinsToMarkers([
      {
        id: "u1",
        lat: 22.28,
        lng: 114.15,
        area: "中環",
        drinkName: "Heineken",
        drinkEmoji: "🍺",
        nickname: "阿怡",
        avatarUrl: null,
        gender: "female",
        checkedInAt: 1,
        isOnline: true,
      },
    ]);
    expect(out).toEqual([{ id: "u1", lat: 22.28, lng: 114.15, label: "阿", online: true }]);
  });
  it("無暱稱退回酒名首字", () => {
    const out = apiPinsToMarkers([
      {
        id: "u2",
        lat: 22.3,
        lng: 114.2,
        area: null,
        drinkName: "Mojito",
        drinkEmoji: "🍹",
        nickname: null,
        avatarUrl: null,
        gender: null,
        checkedInAt: 1,
        isOnline: false,
      },
    ]);
    expect(out[0]?.label).toBe("M");
  });
  it("空數組回空數組", () => {
    expect(apiPinsToMarkers([])).toEqual([]);
  });
});

describe("mockToMarkers (UR C.1)", () => {
  it("mock 轉 marker（在線恆 false，走真心跳前）", () => {
    const out = mockToMarkers([
      {
        id: "m1",
        nickname: "測試",
        avatarEmoji: "🍻",
        gender: "secret",
        drinkName: "測試酒",
        drinkEmoji: "🍺",
        area: "區",
        position: { lat: 22.28, lng: 114.15 },
        checkedInAt: 1,
        onlineAt: 1,
        cheers: 0,
        declinesInvite: false,
        mock: true,
      },
    ]);
    expect(out).toEqual([{ id: "m1", lat: 22.28, lng: 114.15, label: "測", online: false }]);
  });
});
