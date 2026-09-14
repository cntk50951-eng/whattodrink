import { describe, expect, it } from "vitest";

import { displayName, safeNextPath } from "./profile";

describe("safeNextPath", () => {
  it("passes internal paths through", () => {
    expect(safeNextPath("/wall")).toBe("/wall");
    expect(safeNextPath("/")).toBe("/");
  });

  it("blocks open redirects and empties", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
  });
});

describe("displayName", () => {
  it("prefers Google full_name, then name, then email prefix", () => {
    expect(displayName({ full_name: "陳大文" }, "x@gmail.com")).toBe("陳大文");
    expect(displayName({ name: "Tai" }, "x@gmail.com")).toBe("Tai");
    expect(displayName({}, "x@gmail.com")).toBe("x");
  });

  it("falls back to 酒友 when nothing usable", () => {
    expect(displayName(null, null)).toBe("酒友");
    expect(displayName({}, "not-an-email")).toBe("not-an-email");
    expect(displayName({}, "")).toBe("酒友");
  });
});
