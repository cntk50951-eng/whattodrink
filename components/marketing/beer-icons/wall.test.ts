import { describe, expect, it } from "vitest";

import { AsahiIcon } from "./asahi-super-dry";
import { HeinekenIcon } from "./heineken";
import { TsingtaoIcon } from "./tsingtao-classic";
import { BEER_WALL, iconForPickId } from "./wall";

describe("iconForPickId (UR2.6)", () => {
  it("maps the three drawn pick-catalog brands", () => {
    expect(iconForPickId("asahi")).toBe(AsahiIcon);
    expect(iconForPickId("heineken")).toBe(HeinekenIcon);
    expect(iconForPickId("tsingtao")).toBe(TsingtaoIcon);
  });

  it("returns null for undrawn brands (caller keeps the emoji)", () => {
    expect(iconForPickId("mojito")).toBeNull();
    expect(iconForPickId("yamazaki-12")).toBeNull();
    expect(iconForPickId("")).toBeNull();
  });

  it("keeps pickIds unique (first match wins by contract)", () => {
    const ids = BEER_WALL.map((e) => e.pickId).filter(
      (id): id is string => typeof id === "string",
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
