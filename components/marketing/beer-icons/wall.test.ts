import { describe, expect, it } from "vitest";

// vitest 無 @/ alias（見 memory），測檔一律相對路徑。
import { BEERS } from "../../../lib/beers";
import { AguilaIcon } from "./aguila";
import { AndesIcon } from "./andes";
import { AntarcticaIcon } from "./antarctica-original";
import { AsahiIcon } from "./asahi-super-dry";
import { BalboaIcon } from "./balboa";
import { CaribIcon } from "./carib";
import { ClubColombiaIcon } from "./club-colombia";
import { CraftIpaIcon } from "./craft-ipa";
import { CristalIcon } from "./cristal";
import { CusquenaIcon } from "./cusquena-dorada";
import { Dassai45Icon } from "./dassai-45";
import { GuinnessDraughtIcon } from "./guinness-draught";
import { GalloIcon } from "./gallo";
import { HeinekenIcon } from "./heineken";
import { ImperialIcon } from "./imperial";
import { ItaipavaIcon } from "./itaipava";
import { KakuHighballIcon } from "./kaku-highball";
import { KaiserIcon } from "./kaiser";
import { PacenaIcon } from "./pacena";
import { PilsenCallaoIcon } from "./pilsen-callao";
import { PokerIcon } from "./poker";
import { PolarIcon } from "./cerveza-polar";
import { QuilmesIcon } from "./quilmes";
import { RedStripeIcon } from "./red-stripe";
import { RegionalIcon } from "./regional-pilsen";
import { ModeloIcon } from "./modelo-especial";
import { NegraModeloIcon } from "./negra-modelo";
import { TsingtaoIcon } from "./tsingtao-classic";
import { TonaIcon } from "./tona";
import { Yamazaki12YearIcon } from "./yamazaki-12-year";
import { BEER_WALL, iconForDrinkName, iconForPickId } from "./wall";

describe("iconForPickId (UR2.6)", () => {
  it("maps the three drawn pick-catalog brands", () => {
    expect(iconForPickId("asahi")).toBe(AsahiIcon);
    expect(iconForPickId("heineken")).toBe(HeinekenIcon);
    expect(iconForPickId("tsingtao")).toBe(TsingtaoIcon);
  });

  it("returns null for undrawn brands (caller keeps the emoji)", () => {
    expect(iconForPickId("mojito")).toBeNull();
    expect(iconForPickId("malbec-2021")).toBeNull();
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
    expect(iconForDrinkName("角嗨 Highball")).not.toBeNull();
    expect(iconForDrinkName("Mojito")).toBeNull();
    expect(iconForDrinkName("本地精釀 IPA")).not.toBeNull();
    expect(iconForDrinkName("")).toBeNull();
  });

  it("does not match latin aliases inside longer words", () => {
    expect(iconForDrinkName("Absolut Vodka")).toBeNull();
  });
});

describe("batch3a 靜態缺口第一批", () => {
  it("maps the five new pickIds to their components", () => {
    expect(iconForPickId("stout")).toBe(GuinnessDraughtIcon);
    expect(iconForPickId("ipa")).toBe(CraftIpaIcon);
    expect(iconForPickId("yamazaki-12")).toBe(Yamazaki12YearIcon);
    expect(iconForPickId("highball")).toBe(KakuHighballIcon);
    expect(iconForPickId("dasai-45")).toBe(Dassai45Icon);
  });

  it("resolves free-text names via the new aliases", () => {
    expect(iconForDrinkName("Guinness 健力士")).toBe(GuinnessDraughtIcon);
    expect(iconForDrinkName("山崎 12 年")).toBe(Yamazaki12YearIcon);
    expect(iconForDrinkName("獺祭 純米大吟釀 45")).toBe(Dassai45Icon);
    expect(iconForDrinkName("角瓶 highball")).toBe(KakuHighballIcon);
  });
});

describe("batch3 南美拉格十枚", () => {
  it("maps the ten new pickIds to their components", () => {
    expect(iconForPickId("antarctica")).toBe(AntarcticaIcon);
    expect(iconForPickId("itaipava")).toBe(ItaipavaIcon);
    expect(iconForPickId("kaiser")).toBe(KaiserIcon);
    expect(iconForPickId("cristal")).toBe(CristalIcon);
    expect(iconForPickId("quilmes")).toBe(QuilmesIcon);
    expect(iconForPickId("andes")).toBe(AndesIcon);
    expect(iconForPickId("pacena")).toBe(PacenaIcon);
    expect(iconForPickId("cusquena")).toBe(CusquenaIcon);
    expect(iconForPickId("pilsen-callao")).toBe(PilsenCallaoIcon);
    expect(iconForPickId("club-colombia")).toBe(ClubColombiaIcon);
  });

  it("resolves free-text names via the new aliases", () => {
    expect(iconForDrinkName("Antarctica Original")).toBe(AntarcticaIcon);
    expect(iconForDrinkName("Quilmes Clásica")).toBe(QuilmesIcon);
    expect(iconForDrinkName("Cusqueña Dorada")).toBe(CusquenaIcon);
    expect(iconForDrinkName("Pilsen Callao")).toBe(PilsenCallaoIcon);
    expect(iconForDrinkName("Club Colombia Dorada")).toBe(ClubColombiaIcon);
  });

  it("does not steal the champagne namesake (Cristal 誠實回 null)", () => {
    expect(iconForDrinkName("Louis Roederer Cristal")).toBeNull();
    expect(iconForDrinkName("水晶啤酒")).toBe(CristalIcon);
  });
});

describe("batch4 中美加勒比十枚", () => {
  it("maps the ten new pickIds to their components", () => {
    expect(iconForPickId("aguila")).toBe(AguilaIcon);
    expect(iconForPickId("poker")).toBe(PokerIcon);
    expect(iconForPickId("polar")).toBe(PolarIcon);
    expect(iconForPickId("regional")).toBe(RegionalIcon);
    expect(iconForPickId("balboa")).toBe(BalboaIcon);
    expect(iconForPickId("imperial")).toBe(ImperialIcon);
    expect(iconForPickId("tona")).toBe(TonaIcon);
    expect(iconForPickId("gallo")).toBe(GalloIcon);
    expect(iconForPickId("carib")).toBe(CaribIcon);
    expect(iconForPickId("red-stripe")).toBe(RedStripeIcon);
  });

  it("resolves free-text names via the new aliases", () => {
    expect(iconForDrinkName("Aguila Original")).toBe(AguilaIcon);
    expect(iconForDrinkName("Cerveza Polar")).toBe(PolarIcon);
    expect(iconForDrinkName("Regional Pilsen")).toBe(RegionalIcon);
    expect(iconForDrinkName("Toña Nicaragua")).toBe(TonaIcon);
    expect(iconForDrinkName("Gallo Famosa")).toBe(GalloIcon);
    expect(iconForDrinkName("Red Stripe Jamaica")).toBe(RedStripeIcon);
  });

  it("keeps the two eagles apart (Aguila vs Imperial Aguilita)", () => {
    expect(iconForDrinkName("Aguila")).toBe(AguilaIcon);
    expect(iconForDrinkName("Aguilita")).toBe(ImperialIcon);
    expect(iconForDrinkName("cerveza imperial")).toBe(ImperialIcon);
  });
});

describe("pickId 全覆蓋鎖（UR A.20）", () => {
  it("牆上每個條目都有 pickId（新批次加一行即接入，無遺漏）", () => {
    const missing = BEER_WALL.filter((e) => e.pickId === undefined).map((e) => e.en);
    expect(missing).toEqual([]);
  });

  it("每個 pickId 都對上靜態目錄 id（種子雙向可解）", () => {
    const ids = new Set(BEERS.map((b) => b.id));
    const orphan = BEER_WALL.map((e) => e.pickId as string).filter((id) => !ids.has(id));
    expect(orphan).toEqual([]);
  });

  it("靜態目錄裡有畫的品牌全可解出組件", () => {
    const drawn = new Set(
      BEER_WALL.map((e) => e.pickId).filter((id): id is string => typeof id === "string"),
    );
    for (const b of BEERS) {
      if (!drawn.has(b.id)) continue;
      expect(iconForPickId(b.id)).not.toBeNull();
    }
  });
});
