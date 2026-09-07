import { describe, expect, it } from "vitest";

import { AsahiIcon } from "./asahi-super-dry";
import { HeinekenIcon } from "./heineken";
import { ModeloIcon } from "./modelo-especial";
import { NegraModeloIcon } from "./negra-modelo";
import { TsingtaoIcon } from "./tsingtao-classic";
import { BEER_WALL, iconForDrinkName, iconForPickId } from "./wall";

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

describe("iconForDrinkName (UR2.7)", () => {
  it("matches latin substrings case-insensitively (free-text order ok)", () => {
    expect(iconForDrinkName("Asahi 生啤")).toBe(AsahiIcon);
    expect(iconForDrinkName("冰镇 HEINEKEN")).toBe(HeinekenIcon);
  });

  it("matches CJK aliases and prefers the longest alias first", () => {
    // “莫德罗黑啤” 含 “莫德罗”——短别名先中就会错配 Modelo Especial。
    expect(iconForDrinkName("Negra Modelo")).toBe(NegraModeloIcon);
    expect(iconForDrinkName("莫德罗黑啤")).toBe(NegraModeloIcon);
    expect(iconForDrinkName("Modelo Especial")).toBe(ModeloIcon);
  });

  it("returns null when nothing drawn (caller keeps the emoji pin)", () => {
    expect(iconForDrinkName("角嗨 Highball")).toBeNull();
    expect(iconForDrinkName("Mojito")).toBeNull();
    expect(iconForDrinkName("本地精釀 IPA")).toBeNull();
    expect(iconForDrinkName("")).toBeNull();
  });

  it("does not match latin aliases inside longer words", () => {
    expect(iconForDrinkName("Absolut Vodka")).toBeNull();
  });
});
