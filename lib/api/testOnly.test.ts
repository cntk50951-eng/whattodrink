import { describe, expect, it } from "vitest";

import { isTestEndpointsEnabled } from "./testOnly";

describe("isTestEndpointsEnabled", () => {
  it("1／true 开；其余全关（缺省关＝prod 关）", () => {
    expect(isTestEndpointsEnabled("1")).toBe(true);
    expect(isTestEndpointsEnabled("true")).toBe(true);
    expect(isTestEndpointsEnabled(undefined)).toBe(false);
    expect(isTestEndpointsEnabled("")).toBe(false);
    expect(isTestEndpointsEnabled("0")).toBe(false);
    expect(isTestEndpointsEnabled("yes")).toBe(false);
  });
});
