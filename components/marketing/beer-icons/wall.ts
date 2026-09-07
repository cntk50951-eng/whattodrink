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
  /**
   * UR2.6 随机推荐目录 id（`BEERS` 的 id）。有它结果卡才渲染本 icon，
   * 没有就还是 emoji —— 加一行即可接入，无需改面板。
   */
  pickId?: string;
  Icon: BeerIconComponent;
};

/**
 * Single source of truth for the icon set. The preview wall AND the mobile
 * export script (`scripts/export-beer-icons.mjs` via `make-wall.ts`) both read
 * this list — never enumerate icons anywhere else. Append new batches here.
 */
export const BEER_WALL: BeerWallEntry[] = [
  { en: "Asahi Super Dry", cn: "銀罐", pickId: "asahi", type: "乾拉格", Icon: AsahiIcon },
  { en: "Corona Extra", cn: "透明瓶＋青檸", type: "淡拉格", Icon: CoronaIcon },
  { en: "Tsingtao Classic", cn: "綠瓶", pickId: "tsingtao", type: "淡拉格", Icon: TsingtaoIcon },
  { en: "Blue Girl", cn: "藍妹", type: "皮爾森", Icon: BlueGirlIcon },
  { en: "Hoegaarden", cn: "六角杯", type: "小麥白啤", Icon: HoegaardenIcon },
  { en: "Heineken", cn: "綠瓶紅星", pickId: "heineken", type: "淡拉格", Icon: HeinekenIcon },
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

/**
 * UR2.6 按推荐目录 id 取 icon。命中返回组件，未命中返回 null（调用方保留
 * emoji 默认）。同一 pickId 出现多次取 BEER_WALL 第一顺位。
 */
export function iconForPickId(pickId: string): BeerIconComponent | null {
  return BEER_WALL.find((e) => e.pickId === pickId)?.Icon ?? null;
}

type BrandAlias = {
  slug: string;
  /** 拉丁别名整词匹配（大小写不敏感），中文别名子串匹配。 */
  latin: string[];
  cjk: string[];
};

/**
 * UR2.7 追加：自由文本酒名 → 已画品牌。按表顺序＋别名长度优先，
 * 长别名先比（"百威淡啤" 必须先于 "百威"，"莫德罗黑啤" 先于 "莫德罗"）。
 * 猜不到返回 null —— pin／卡片保持默认，不硬凑。
 */
const BRAND_ALIASES: BrandAlias[] = [
  { slug: "bud-light", latin: ["bud light"], cjk: ["百威淡啤"] },
  { slug: "negra-modelo", latin: ["negra modelo", "negra"], cjk: ["莫德罗黑啤", "莫德羅黑啤"] },
  { slug: "coors-light", latin: ["coors"], cjk: ["酷姿"] },
  { slug: "miller-lite", latin: ["miller"], cjk: ["米勒"] },
  { slug: "young-master", latin: ["young master"], cjk: ["少爺", "少爷"] },
  { slug: "blue-girl", latin: ["blue girl"], cjk: ["藍妹", "蓝妹"] },
  { slug: "kirin-ichiban", latin: ["kirin", "ichiban"], cjk: ["麒麟", "一番搾", "一番榨"] },
  { slug: "moutai-flying-fairy", latin: ["moutai", "maotai"], cjk: ["茅台", "飞天", "飛天"] },
  { slug: "asahi-super-dry", latin: ["asahi", "super dry"], cjk: ["朝日"] },
  { slug: "corona-extra", latin: ["corona"], cjk: ["科罗娜"] },
  { slug: "tsingtao-classic", latin: ["tsingtao"], cjk: ["青島", "青岛"] },
  { slug: "hoegaarden", latin: ["hoegaarden"], cjk: ["豪格登"] },
  { slug: "heineken", latin: ["heineken"], cjk: ["喜力"] },
  { slug: "yebisu", latin: ["yebisu"], cjk: ["惠比寿", "惠比壽"] },
  { slug: "budweiser", latin: ["budweiser", "bud"], cjk: ["百威"] },
  { slug: "carlsberg", latin: ["carlsberg"], cjk: ["嘉士伯"] },
  { slug: "sapporo", latin: ["sapporo"], cjk: ["札幌"] },
  { slug: "snow", latin: ["snow"], cjk: ["雪花", "勇闯天涯", "勇闖天涯"] },
  { slug: "yanjing", latin: ["yanjing"], cjk: ["燕京"] },
  { slug: "harbin", latin: ["harbin"], cjk: ["哈尔滨", "哈爾濱", "哈啤"] },
  { slug: "modelo-especial", latin: ["modelo", "especial"], cjk: ["莫德罗", "莫德羅"] },
  { slug: "pacifico", latin: ["pacifico", "pacific"], cjk: ["太平洋"] },
  { slug: "tecate", latin: ["tecate"], cjk: ["特卡特"] },
  { slug: "dos-equis", latin: ["dos equis"], cjk: ["双X", "雙X"] },
  { slug: "sol", latin: ["sol"], cjk: ["太阳", "太陽"] },
  { slug: "bohemia", latin: ["bohemia"], cjk: ["波西米亚", "波希米亞"] },
  { slug: "victoria", latin: ["victoria"], cjk: ["维多利亚", "維多利亞"] },
  { slug: "indio", latin: ["indio"], cjk: ["印第欧", "印第歐"] },
  { slug: "skol", latin: ["skol"], cjk: ["斯库尔", "斯庫爾"] },
  { slug: "brahma", latin: ["brahma"], cjk: ["布拉马", "布拉瑪"] },
];

// beerSlug 产下划线（asahi_super_dry），别名表用连字符书写，建表时统一。
const slugToIcon = new Map(
  BEER_WALL.map((e) => [beerSlug(e.en).replace(/_/g, "-"), e.Icon]),
);

export function iconForDrinkName(drinkName: string): BeerIconComponent | null {
  const lower = drinkName.toLowerCase();
  const flat = BRAND_ALIASES.flatMap((b) => [
    ...b.latin.map((a) => ({ alias: a, latin: true, slug: b.slug })),
    ...b.cjk.map((a) => ({ alias: a, latin: false, slug: b.slug })),
  ]).sort((x, y) => y.alias.length - x.alias.length);
  for (const { alias, latin, slug } of flat) {
    const hit = latin
      ? new RegExp(`(?<![a-z])${alias.replace(/ /g, "\\s+")}(?![a-z])`).test(lower)
      : drinkName.includes(alias);
    if (hit) return slugToIcon.get(slug) ?? null;
  }
  return null;
}
