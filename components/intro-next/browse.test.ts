import { describe, expect, it, vi } from "vitest";

import { FPS } from "../intro/kit";
import { browseIndexAt, completeSwipe, isHorizontalIntent, seekBrowseStop, swipeDirection } from "./browse";
import { INTRO_COPY } from "./copy";
import { BROWSE_STOPS, END_SEC, TOTAL_FRAMES } from "./story";
import { screenAt } from "./motion";

describe("manual screen browsing", () => {
  it("includes nested screens and both endpoints without restoring the removed preview", () => {
    const ids = BROWSE_STOPS.map((stop) => stop.id);
    expect(ids[0]).toBe("intro");
    expect(ids.at(-1)).toBe("end");
    expect(ids.filter((id) => id.startsWith("cocktail:"))).toHaveLength(4);
    expect(ids.filter((id) => id.startsWith("trail:"))).toHaveLength(3);
    expect(ids).not.toContain("publish:0");
  });

  it("lands after fades and before the next page starts, in the legal frame range", () => {
    for (const [i, stop] of BROWSE_STOPS.entries()) {
      expect(Number.isInteger(stop.settledFrame)).toBe(true);
      expect(stop.settledFrame).toBeGreaterThanOrEqual(stop.frame);
      expect(stop.settledFrame).toBeLessThan(BROWSE_STOPS[i + 1]?.frame ?? TOTAL_FRAMES);
      if (stop.kind === "screen") {
        const pose = screenAt(stop.settledFrame / FPS, stop.frame / FPS, undefined, stop.shotIndex === 0, 1, "dissolve");
        expect(pose.opacity).toBe(1);
      }
      expect(browseIndexAt(stop.settledFrame, BROWSE_STOPS)).toBe(i);
    }
    expect(BROWSE_STOPS.at(-1)?.settledFrame).toBeGreaterThan(END_SEC * FPS);
  });

  it("pauses before seeking and clamps manual navigation instead of wrapping", () => {
    const calls: string[] = [];
    const player = { pause: () => calls.push("pause"), seekTo: (frame: number) => calls.push(`seek:${frame}`) };
    expect(seekBrowseStop(player, 4, BROWSE_STOPS)).toBe(4);
    expect(calls).toEqual(["pause", `seek:${BROWSE_STOPS[4].settledFrame}`]);
    expect(seekBrowseStop(player, -1, BROWSE_STOPS)).toBe(0);
    expect(seekBrowseStop(player, 999, BROWSE_STOPS)).toBe(BROWSE_STOPS.length - 1);
    const empty = { pause: vi.fn(), seekTo: vi.fn() };
    expect(seekBrowseStop(empty, 0, [])).toBe(-1);
    expect(empty.pause).not.toHaveBeenCalled();
  });

  it("tracks exact cuts and playback loops without stale section indexes", () => {
    for (let i = 1; i < BROWSE_STOPS.length; i++) {
      expect(browseIndexAt(BROWSE_STOPS[i].frame - 1, BROWSE_STOPS)).toBe(i - 1);
      expect(browseIndexAt(BROWSE_STOPS[i].frame, BROWSE_STOPS)).toBe(i);
    }
    expect(browseIndexAt(0, BROWSE_STOPS)).toBe(0);
    expect(browseIndexAt(0, [])).toBe(-1);
  });

  it("provides all manual-control text in each of the three languages", () => {
    for (const copy of Object.values(INTRO_COPY)) {
      expect(Object.keys(copy.browse)).toHaveLength(8);
      for (const value of Object.values(copy.browse)) expect(value.trim()).not.toBe("");
    }
  });
});

describe("horizontal swipe intent", () => {
  it("leaves accepted browsing paused and restores only interrupted autoplay on cancellation", () => {
    expect(completeSwipe(-90, 2, 390, false, true, true)).toEqual({ direction: 1, resume: false });
    expect(completeSwipe(-90, 2, 390, true, true, true)).toEqual({ direction: null, resume: true });
    expect(completeSwipe(-90, 2, 390, true, true, false)).toEqual({ direction: null, resume: false });
    expect(completeSwipe(20, 2, 390, false, true, true)).toEqual({ direction: null, resume: true });
    expect(completeSwipe(2, 0, 390, false, false, true)).toEqual({ direction: null, resume: false });
  });
  it("maps left to next and right to previous on phone and desktop widths", () => {
    expect(swipeDirection(-70, 10, 390)).toBe(1);
    expect(swipeDirection(70, -10, 390)).toBe(-1);
    expect(swipeDirection(-100, 5, 1440)).toBe(1);
  });
  it("ignores taps, short drags, vertical movement and diagonal scrolling", () => {
    for (const [dx, dy] of [[0, 0], [20, 0], [43, 3], [10, 90], [60, 70], [70, 60]]) {
      expect(swipeDirection(dx, dy, 390)).toBeNull();
    }
    expect(isHorizontalIntent(13, 2)).toBe(true);
    expect(isHorizontalIntent(5, 1)).toBe(false);
    expect(isHorizontalIntent(15, 30)).toBe(false);
  });
});
