import { describe, expect, it } from "vitest";

import { previewFrame } from "./playback";

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
