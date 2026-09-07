import { afterEach, describe, expect, it, vi } from "vitest";

import { BUZZ_FOUND, BUZZ_MISS, BUZZ_PRIME, buzz } from "./haptics";

describe("buzz (UR2.9)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false without throwing when vibrate is unavailable (iOS Safari)", () => {
    vi.stubGlobal("navigator", {});
    expect(buzz(BUZZ_FOUND)).toBe(false);
  });

  it("forwards the pattern and returns the platform result", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { vibrate });
    expect(buzz(BUZZ_MISS)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([...BUZZ_MISS]);
  });

  it("returns false when the platform throws", () => {
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new DOMException("blocked");
      },
    });
    expect(buzz(BUZZ_PRIME)).toBe(false);
  });
});
