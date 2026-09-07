import { describe, expect, it } from "vitest";

import { shouldShowLastPlace, touchVisit } from "./visit";

describe("shouldShowLastPlace (UR3.5)", () => {
  it("shows only when both areas exist and differ", () => {
    expect(
      shouldShowLastPlace({ at: 1, area: "深水埗" }, "中環"),
    ).toBe(true);
    // 一样不显示。
    expect(shouldShowLastPlace({ at: 1, area: "中環" }, "中環")).toBe(false);
    // 任一缺席不显示。
    expect(shouldShowLastPlace({ at: 1 }, "中環")).toBe(false);
    expect(shouldShowLastPlace(null, "中環")).toBe(false);
    expect(shouldShowLastPlace({ at: 1, area: "深水埗" }, null)).toBe(false);
    expect(shouldShowLastPlace({ at: 1, area: "" }, "中環")).toBe(false);
  });
});

describe("touchVisit (UR3.5)", () => {
  it("returns null on the server without throwing", () => {
    expect(touchVisit(Date.now())).toBeNull();
  });
});
