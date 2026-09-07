import { describe, expect, it } from "vitest";

import type { Checkin } from "./checkins";
import { pickNearestRecentCheckin, RECENT_WINDOW_MS } from "./shake";

const NOW = 1_700_000_000_000;
const H = 3600_000;

function fake(id: string, lat: number, hoursAgo: number): Checkin {
  return {
    id,
    nickname: id,
    avatarEmoji: "🍺",
    gender: "secret",
    drinkEmoji: "🍺",
    drinkName: id,
    area: "test",
    position: { lat, lng: 114.17 },
    cheers: 0,
    checkedInAt: NOW - hoursAgo * H,
    onlineAt: NOW,
    declinesInvite: false,
    mock: true,
  };
}

describe("pickNearestRecentCheckin", () => {
  it("picks the nearest checkin inside the window", () => {
    const self = { lat: 22.3, lng: 114.17 };
    const far = fake("far", 22.31, 1);
    const near = fake("near", 22.3005, 2);
    expect(pickNearestRecentCheckin(self, [far, near], NOW)).toBe(near);
  });

  it("skips stale checkins even when nearer", () => {
    const self = { lat: 22.3, lng: 114.17 };
    const staleNear = fake("stale", 22.3001, 30);
    const freshFar = fake("fresh", 22.32, 1);
    expect(pickNearestRecentCheckin(self, [staleNear, freshFar], NOW)).toBe(
      freshFar,
    );
  });

  it("returns null when the window is empty", () => {
    const self = { lat: 22.3, lng: 114.17 };
    expect(pickNearestRecentCheckin(self, [], NOW)).toBeNull();
    expect(
      pickNearestRecentCheckin(self, [fake("old", 22.3, 25)], NOW),
    ).toBeNull();
  });

  it("keeps a checkin right at the window edge", () => {
    const self = { lat: 22.3, lng: 114.17 };
    const edge = fake("edge", 22.3, RECENT_WINDOW_MS / H);
    expect(pickNearestRecentCheckin(self, [edge], NOW)).toBe(edge);
  });
});
