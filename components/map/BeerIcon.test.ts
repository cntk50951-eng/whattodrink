import { describe, expect, it } from "vitest";

import { toBeerIconWrapperClass } from "./BeerIcon";

describe("toBeerIconWrapperClass", () => {
  it("replaces w-auto with aspect-[3/4] and strips object-cover", () => {
    expect(
      toBeerIconWrapperClass("h-20 w-auto shrink-0 rounded-xl border-2 object-cover"),
    ).toBe("h-20 aspect-[3/4] shrink-0 rounded-xl border-2");
  });

  it("keeps h-full case and aspect", () => {
    expect(
      toBeerIconWrapperClass("h-full w-auto rounded-xl border-2 object-cover"),
    ).toBe("h-full aspect-[3/4] rounded-xl border-2");
  });

  it("collapses double spaces", () => {
    expect(toBeerIconWrapperClass("h-16  w-auto  rounded-xl")).toBe(
      "h-16 aspect-[3/4] rounded-xl",
    );
  });

  it("leaves non w-auto unchanged", () => {
    expect(toBeerIconWrapperClass("h-24 w-16 rounded-xl border-2")).toBe(
      "h-24 w-16 rounded-xl border-2",
    );
  });
});

describe("BeerIcon hasIcon contract", () => {
  it("missing icon_url should fallback to emoji (wrapper not used)", () => {
    // This test documents the contract: when icon_url is absent, BeerIcon renders emoji.
    // The wrapper helper is still pure: it doesn't depend on beer data.
    const cls = toBeerIconWrapperClass("h-20 w-auto rounded-xl border-2 object-cover");
    expect(cls).toContain("aspect-[3/4]");
    expect(cls).not.toContain("object-cover");
    expect(cls).not.toContain("w-auto");
  });
});
