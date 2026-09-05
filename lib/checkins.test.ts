import { describe, expect, it } from "vitest";

import { MOCK_CHECKINS } from "./checkins";
import { isWithinHongKong } from "./geo";

describe("MOCK_CHECKINS seed data", () => {
  it("has unique ids", () => {
    const ids = MOCK_CHECKINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places every seed inside Hong Kong", () => {
    for (const c of MOCK_CHECKINS) {
      expect(isWithinHongKong(c.position)).toBe(true);
    }
  });

  it("fills every display field and flags mock", () => {
    expect(MOCK_CHECKINS.length).toBeGreaterThan(0);
    for (const c of MOCK_CHECKINS) {
      expect(c.nickname.trim().length).toBeGreaterThan(0);
      expect(c.drinkName.trim().length).toBeGreaterThan(0);
      expect(c.area.trim().length).toBeGreaterThan(0);
      expect(c.cheers).toBeGreaterThanOrEqual(0);
      expect(c.mock).toBe(true);
    }
  });
});
