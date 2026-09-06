import type { ComponentType } from "react";
import { AsahiIcon } from "./asahi-super-dry";
import { BlueGirlIcon } from "./blue-girl";
import { BohemiaIcon } from "./bohemia";
import { BrahmaIcon } from "./brahma";
import { BudLightIcon } from "./bud-light";
import { BudweiserIcon } from "./budweiser";
import { CarlsbergIcon } from "./carlsberg";
import { CoorsLightIcon } from "./coors-light";
import { CoronaIcon } from "./corona-extra";
import { DosEquisIcon } from "./dos-equis";
import { HarbinIcon } from "./harbin";
import { HeinekenIcon } from "./heineken";
import { HoegaardenIcon } from "./hoegaarden";
import { IndioIcon } from "./indio";
import { KirinIcon } from "./kirin-ichiban";
import { MillerLiteIcon } from "./miller-lite";
import { ModeloIcon } from "./modelo-especial";
import { MoutaiIcon } from "./moutai-flying-fairy";
import { NegraModeloIcon } from "./negra-modelo";
import { PacificoIcon } from "./pacifico";
import { SapporoIcon } from "./sapporo";
import { SkolIcon } from "./skol";
import { SnowIcon } from "./snow";
import { SolIcon } from "./sol";
import { TecateIcon } from "./tecate";
import { TsingtaoIcon } from "./tsingtao-classic";
import { VictoriaIcon } from "./victoria";
import { YanjingIcon } from "./yanjing";
import { YebisuIcon } from "./yebisu";
import { YoungMasterIcon } from "./young-master";

export type BeerIconComponent = ComponentType<{ className?: string }>;

export type BeerWallEntry = {
  /** English brand/product name — also the mobile-asset slug source. */
  en: string;
  /** Chinese short label for the preview wall. */
  cn: string;
  /** Short CN style tag — must match the icon file's typeLabel prop. */
  type: string;
  Icon: BeerIconComponent;
};

/**
 * Single source of truth for the icon set. The preview wall AND the mobile
 * export script (`scripts/export-beer-icons.mjs` via `make-wall.ts`) both read
 * this list — never enumerate icons anywhere else. Append new batches here.
 */
export const BEER_WALL: BeerWallEntry[] = [
  { en: "Asahi Super Dry", cn: "銀罐", type: "乾拉格", Icon: AsahiIcon },
  { en: "Corona Extra", cn: "透明瓶＋青檸", type: "淡拉格", Icon: CoronaIcon },
  { en: "Tsingtao Classic", cn: "綠瓶", type: "淡拉格", Icon: TsingtaoIcon },
  { en: "Blue Girl", cn: "藍妹", type: "皮爾森", Icon: BlueGirlIcon },
  { en: "Hoegaarden", cn: "六角杯", type: "小麥白啤", Icon: HoegaardenIcon },
  { en: "Heineken", cn: "綠瓶紅星", type: "淡拉格", Icon: HeinekenIcon },
  { en: "Kirin Ichiban", cn: "一番搾", type: "淡拉格", Icon: KirinIcon },
  { en: "Yebisu", cn: "金罐", type: "拉格", Icon: YebisuIcon },
  { en: "Young Master", cn: "少爺", type: "淡艾", Icon: YoungMasterIcon },
  { en: "Moutai Flying Fairy", cn: "茅台", type: "醬香白酒", Icon: MoutaiIcon },
  { en: "Budweiser", cn: "百威", type: "美式拉格", Icon: BudweiserIcon },
  { en: "Carlsberg", cn: "嘉士伯", type: "皮爾森", Icon: CarlsbergIcon },
  { en: "Sapporo", cn: "札幌", type: "拉格", Icon: SapporoIcon },
  { en: "Snow", cn: "雪花", type: "淡拉格", Icon: SnowIcon },
  { en: "Yanjing", cn: "燕京", type: "淡拉格", Icon: YanjingIcon },
  { en: "Harbin", cn: "哈尔滨", type: "拉格", Icon: HarbinIcon },
  { en: "Bud Light", cn: "百威淡啤", type: "淡拉格", Icon: BudLightIcon },
  { en: "Coors Light", cn: "酷姿淡啤", type: "淡拉格", Icon: CoorsLightIcon },
  { en: "Miller Lite", cn: "米勒淡啤", type: "淡拉格", Icon: MillerLiteIcon },
  { en: "Modelo Especial", cn: "莫德罗", type: "淡拉格", Icon: ModeloIcon },
  { en: "Negra Modelo", cn: "莫德罗黑啤", type: "深色拉格", Icon: NegraModeloIcon },
  { en: "Pacifico", cn: "太平洋", type: "皮爾森", Icon: PacificoIcon },
  { en: "Tecate", cn: "特卡特", type: "淡拉格", Icon: TecateIcon },
  { en: "Dos Equis", cn: "双 X", type: "淡拉格", Icon: DosEquisIcon },
  { en: "Sol", cn: "太阳", type: "淡拉格", Icon: SolIcon },
  { en: "Bohemia", cn: "波西米亚", type: "皮爾森", Icon: BohemiaIcon },
  { en: "Victoria", cn: "维多利亚", type: "維也納拉格", Icon: VictoriaIcon },
  { en: "Indio", cn: "印第欧", type: "深色拉格", Icon: IndioIcon },
  { en: "Skol", cn: "斯库尔", type: "皮爾森", Icon: SkolIcon },
  { en: "Brahma", cn: "布拉马", type: "皮爾森", Icon: BrahmaIcon },
];

/** Android-safe asset slug: `Modelo Especial` → `modelo_especial`. */
export function beerSlug(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
