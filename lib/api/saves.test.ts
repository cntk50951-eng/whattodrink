import { describe, expect, it } from "vitest";

import { buildSaveJson } from "./saves";

describe("buildSaveJson", () => {
  it("只回 saved，无 count 面", () => {
    expect(buildSaveJson(true)).toEqual({ saved: true });
    expect(buildSaveJson(false)).toEqual({ saved: false });
  });
});
