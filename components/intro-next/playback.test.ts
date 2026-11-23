import { describe, expect, it } from "vitest";

import { initializePlayback, previewFrame } from "./playback";

describe("intro-next previewFrame", () => {
  it("ignores absent, empty and invalid preview times", () => {
    for (const value of [null, "", " ", "oops", "Infinity", "NaN"]) expect(previewFrame(value, 30, 300)).toBeNull();
  });
  it("clamps preview times to the real frame range", () => {
    expect(previewFrame("-10", 30, 300)).toBe(0);
    expect(previewFrame("100", 30, 300)).toBe(299);
    expect(previewFrame("1.25", 60, 600)).toBe(75);
  });
});

describe("silent intro startup", () => {
  const options = { search: "", fps: 30, totalFrames: 300, reducedMotion: false, reading: false, readingFrame: 84, reducedFrame: 240 };
  function browserPlayer(): { player: Parameters<typeof initializePlayback>[0]; calls: string[]; advances: () => boolean } {
    const calls: string[] = [];
    let muted = false;
    let advancing = false;
    return {
      calls,
      advances: () => advancing,
      player: {
        mute: () => { muted = true; calls.push("mute"); },
        pause: () => { advancing = false; calls.push("pause"); },
        seekTo: (frame) => { calls.push(`seek:${frame}`); },
        // Model a browser that cannot resume an unmuted AudioContext without a gesture.
        play: () => { advancing = muted; calls.push("play"); },
      },
    };
  }
  it("starts without an audio gesture on both first load and refresh", () => {
    for (let visit = 0; visit < 2; visit++) {
      const browser = browserPlayer();
      initializePlayback(browser.player, options);
      expect(browser.advances()).toBe(true);
      expect(browser.calls).toEqual(["mute", "play"]);
    }
  });
  it("autoplays old time links, including frame zero, instead of silently freezing", () => {
    for (const [search, frame] of [["?t=2.8", 84], ["?t=0", 0], ["?t=999", 299]] as const) {
      const browser = browserPlayer();
      initializePlayback(browser.player, { ...options, search });
      expect(browser.calls).toEqual(["mute", "pause", `seek:${frame}`, "play"]);
      expect(browser.advances()).toBe(true);
    }
  });
  it("freezes only an explicit preview and keeps invalid time links playable", () => {
    const preview = browserPlayer();
    initializePlayback(preview.player, { ...options, search: "?t=2.8&preview=1" });
    expect(preview.calls).toEqual(["mute", "pause", "seek:84"]);
    expect(preview.advances()).toBe(false);
    const invalid = browserPlayer();
    initializePlayback(invalid.player, { ...options, search: "?t=oops" });
    expect(invalid.calls).toEqual(["mute", "play"]);
  });
  it("honours reduced motion and reading initiated before images finished loading", () => {
    const reduced = browserPlayer();
    initializePlayback(reduced.player, { ...options, reducedMotion: true, search: "?t=2.8" });
    expect(reduced.calls).toEqual(["mute", "pause", "seek:240"]);
    const reading = browserPlayer();
    initializePlayback(reading.player, { ...options, reading: true });
    expect(reading.calls).toEqual(["mute", "pause", "seek:84"]);
  });
});
