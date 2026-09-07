import { describe, expect, it } from "vitest";

import { MOCK_CHECKINS } from "./checkins";
import {
  NEARBY_KM,
  ONLINE_WINDOW_MS,
  isNearbyOnline,
  isOnline,
} from "./nearby";

const NOW = 1_700_000_000_000;
const SELF = { lat: 22.2819, lng: 114.1577 }; // 中环（mock-central 同点）

function checkin(over: Record<string, unknown> = {}) {
  return {
    id: "x",
    nickname: "X",
    avatarEmoji: "🧑",
    gender: "male",
    drinkEmoji: "🍺",
    drinkName: "Test",
    area: "中環",
    position: { ...SELF },
    cheers: 0,
    checkedInAt: NOW,
    onlineAt: NOW,
    declinesInvite: false,
    mock: true,
    ...over,
  } as const;
}

describe("nearby online (UR3.3)", () => {
  it("pins the contract numbers (5 min window, 5 km)", () => {
    expect(ONLINE_WINDOW_MS).toBe(5 * 60_000);
    expect(NEARBY_KM).toBe(5);
  });

  it("treats heartbeats inside the window as online", () => {
    expect(isOnline(checkin({ onlineAt: NOW }), NOW)).toBe(true);
    expect(
      isOnline(checkin({ onlineAt: NOW - ONLINE_WINDOW_MS }), NOW),
    ).toBe(true);
    expect(
      isOnline(checkin({ onlineAt: NOW - ONLINE_WINDOW_MS - 1 }), NOW),
    ).toBe(false);
    // 未来心跳（时钟 skew）不算在线。
    expect(isOnline(checkin({ onlineAt: NOW + 1000 }), NOW)).toBe(false);
  });

  it("requires both online and within 5 km", () => {
    expect(isNearbyOnline(SELF, checkin(), NOW)).toBe(true);
    // 沙田→中环约 11km（out）；旺角→中环约 4.3km 仍算附近（in）。
    const far = { lat: 22.38, lng: 114.19 };
    expect(isNearbyOnline(SELF, checkin({ position: far }), NOW)).toBe(false);
    expect(
      isNearbyOnline(SELF, checkin({ onlineAt: 0 }), NOW),
    ).toBe(false);
  });

  it("covers every mock entry with sane new fields", () => {
    for (const c of MOCK_CHECKINS) {
      expect(typeof c.onlineAt).toBe("number");
      expect(typeof c.declinesInvite).toBe("boolean");
      // 种子相对加载时：全员在线（验收三态：接受×3＋婉拒×1）。
      expect(isOnline(c, Date.now())).toBe(true);
    }
    expect(MOCK_CHECKINS.filter((c) => c.declinesInvite)).toHaveLength(1);
  });
});
