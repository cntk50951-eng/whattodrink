import type { ComponentType } from "react";
import { AsahiIcon } from "./asahi-super-dry";
import { AndesIcon } from "./andes";
import { AntarcticaIcon } from "./antarctica-original";
import { BlueGirlIcon } from "./blue-girl";
import { BohemiaIcon } from "./bohemia";
import { BrahmaIcon } from "./brahma";
import { BudLightIcon } from "./bud-light";
import { BudweiserIcon } from "./budweiser";
import { CarlsbergIcon } from "./carlsberg";
import { ClubColombiaIcon } from "./club-colombia";
import { CoorsLightIcon } from "./coors-light";
import { CoronaIcon } from "./corona-extra";
import { CraftIpaIcon } from "./craft-ipa";
import { CristalIcon } from "./cristal";
import { CusquenaIcon } from "./cusquena-dorada";
import { Dassai45Icon } from "./dassai-45";
import { DosEquisIcon } from "./dos-equis";
import { GuinnessDraughtIcon } from "./guinness-draught";
import { HarbinIcon } from "./harbin";
import { HeinekenIcon } from "./heineken";
import { HoegaardenIcon } from "./hoegaarden";
import { IndioIcon } from "./indio";
import { ItaipavaIcon } from "./itaipava";
import { KaiserIcon } from "./kaiser";
import { KirinIcon } from "./kirin-ichiban";
import { KakuHighballIcon } from "./kaku-highball";
import { MillerLiteIcon } from "./miller-lite";
import { ModeloIcon } from "./modelo-especial";
import { MoutaiIcon } from "./moutai-flying-fairy";
import { NegraModeloIcon } from "./negra-modelo";
import { PacificoIcon } from "./pacifico";
import { PacenaIcon } from "./pacena";
import { PilsenCallaoIcon } from "./pilsen-callao";
import { QuilmesIcon } from "./quilmes";
import { SapporoIcon } from "./sapporo";
import { SkolIcon } from "./skol";
import { SnowIcon } from "./snow";
import { SolIcon } from "./sol";
import { TecateIcon } from "./tecate";
import { TsingtaoIcon } from "./tsingtao-classic";
import { VictoriaIcon } from "./victoria";
import { YanjingIcon } from "./yanjing";
import { Yamazaki12YearIcon } from "./yamazaki-12-year";
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
  { en: "Corona Extra", cn: "透明瓶＋青檸", pickId: "corona-extra", type: "淡拉格", Icon: CoronaIcon },
  { en: "Tsingtao Classic", cn: "綠瓶", pickId: "tsingtao", type: "淡拉格", Icon: TsingtaoIcon },
  { en: "Blue Girl", cn: "藍妹", pickId: "blue-girl", type: "皮爾森", Icon: BlueGirlIcon },
  { en: "Hoegaarden", cn: "六角杯", pickId: "hoegaarden", type: "小麥白啤", Icon: HoegaardenIcon },
  { en: "Heineken", cn: "綠瓶紅星", pickId: "heineken", type: "淡拉格", Icon: HeinekenIcon },
  { en: "Kirin Ichiban", cn: "一番搾", pickId: "kirin-ichiban", type: "淡拉格", Icon: KirinIcon },
  { en: "Yebisu", cn: "金罐", pickId: "yebisu", type: "拉格", Icon: YebisuIcon },
  { en: "Young Master", cn: "少爺", pickId: "young-master", type: "淡艾", Icon: YoungMasterIcon },
  { en: "Moutai Flying Fairy", cn: "茅台", pickId: "moutai-flying-fairy", type: "醬香白酒", Icon: MoutaiIcon },
  { en: "Budweiser", cn: "百威", pickId: "budweiser", type: "美式拉格", Icon: BudweiserIcon },
  { en: "Carlsberg", cn: "嘉士伯", pickId: "carlsberg", type: "皮爾森", Icon: CarlsbergIcon },
  { en: "Sapporo", cn: "札幌", pickId: "sapporo", type: "拉格", Icon: SapporoIcon },
  { en: "Snow", cn: "雪花", pickId: "snow", type: "淡拉格", Icon: SnowIcon },
  { en: "Yanjing", cn: "燕京", pickId: "yanjing", type: "淡拉格", Icon: YanjingIcon },
  { en: "Harbin", cn: "哈尔滨", pickId: "harbin", type: "拉格", Icon: HarbinIcon },
  { en: "Bud Light", cn: "百威淡啤", pickId: "bud-light", type: "淡拉格", Icon: BudLightIcon },
  { en: "Coors Light", cn: "酷姿淡啤", pickId: "coors-light", type: "淡拉格", Icon: CoorsLightIcon },
  { en: "Miller Lite", cn: "米勒淡啤", pickId: "miller-lite", type: "淡拉格", Icon: MillerLiteIcon },
  { en: "Modelo Especial", cn: "莫德罗", pickId: "modelo-especial", type: "淡拉格", Icon: ModeloIcon },
  { en: "Negra Modelo", cn: "莫德罗黑啤", pickId: "negra-modelo", type: "深色拉格", Icon: NegraModeloIcon },
  { en: "Pacifico", cn: "太平洋", pickId: "pacifico", type: "皮爾森", Icon: PacificoIcon },
  { en: "Tecate", cn: "特卡特", pickId: "tecate", type: "淡拉格", Icon: TecateIcon },
  { en: "Dos Equis", cn: "双 X", pickId: "dos-equis", type: "淡拉格", Icon: DosEquisIcon },
  { en: "Sol", cn: "太阳", pickId: "sol", type: "淡拉格", Icon: SolIcon },
  { en: "Bohemia", cn: "波西米亚", pickId: "bohemia", type: "皮爾森", Icon: BohemiaIcon },
  { en: "Victoria", cn: "维多利亚", pickId: "victoria", type: "維也納拉格", Icon: VictoriaIcon },
  { en: "Indio", cn: "印第欧", pickId: "indio", type: "深色拉格", Icon: IndioIcon },
  { en: "Skol", cn: "斯库尔", pickId: "skol", type: "皮爾森", Icon: SkolIcon },
  { en: "Brahma", cn: "布拉马", pickId: "brahma", type: "皮爾森", Icon: BrahmaIcon },
  /* Batch3a（靜態缺口第一批：啤酒 lane 收尾＋威士忌＋清酒；IPA／角嗨為演繹版） */
  { en: "Guinness Draught", cn: "黑罐金豎琴", pickId: "stout", type: "世濤", Icon: GuinnessDraughtIcon },
  { en: "Craft IPA", cn: "鬱金香杯", pickId: "ipa", type: "印度淡艾", Icon: CraftIpaIcon },
  { en: "Yamazaki 12 Year", cn: "方瓶", pickId: "yamazaki-12", type: "單一麥芽", Icon: Yamazaki12YearIcon },
  { en: "Kaku Highball", cn: "角瓶", pickId: "highball", type: "高球", Icon: KakuHighballIcon },
  { en: "Dassai 45", cn: "白標藍字", pickId: "dasai-45", type: "大吟釀", Icon: Dassai45Icon },
  /* Batch3（隊列第三批：南美拉格 10；Cristal 指智利啤酒非香檳） */
  { en: "Antarctica Original", cn: "企鵝黃標", pickId: "antarctica", type: "淡拉格", Icon: AntarcticaIcon },
  { en: "Itaipava Pilsen", cn: "紅白冠", pickId: "itaipava", type: "淡拉格", Icon: ItaipavaIcon },
  { en: "Kaiser", cn: "金灰K", pickId: "kaiser", type: "淡拉格", Icon: KaiserIcon },
  { en: "Cristal", cn: "藍字水晶", pickId: "cristal", type: "淡拉格", Icon: CristalIcon },
  { en: "Quilmes Clasica", cn: "藍白拖拉機", pickId: "quilmes", type: "淡拉格", Icon: QuilmesIcon },
  { en: "Andes Origen", cn: "紅字雪山", pickId: "andes", type: "淡拉格", Icon: AndesIcon },
  { en: "Paceña", cn: "三色徽章", pickId: "pacena", type: "淡拉格", Icon: PacenaIcon },
  { en: "Cusqueña Dorada", cn: "金日太陽", pickId: "cusquena", type: "淡拉格", Icon: CusquenaIcon },
  { en: "Pilsen Callao", cn: "綠旗皇冠", pickId: "pilsen-callao", type: "淡拉格", Icon: PilsenCallaoIcon },
  { en: "Club Colombia Dorada", cn: "紅金花絲", pickId: "club-colombia", type: "淡拉格", Icon: ClubColombiaIcon },
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
  /* Batch3a：健力士／IPA（泛稱演繹）／山崎／角嗨／獺祭 */
  { slug: "guinness-draught", latin: ["guinness"], cjk: ["健力士", "吉尼斯"] },
  { slug: "craft-ipa", latin: ["ipa"], cjk: ["精釀"] },
  { slug: "yamazaki-12-year", latin: ["yamazaki"], cjk: ["山崎"] },
  { slug: "kaku-highball", latin: ["highball", "kaku", "kakubin"], cjk: ["角嗨", "角瓶", "嗨棒"] },
  { slug: "dassai-45", latin: ["dassai", "dasai"], cjk: ["獺祭", "獭祭"] },
  /* Batch3：南美 10（ñ 走 beerSlug 轉寫：pace-a／cusque-a-dorada；
   * Cristal 只收啤酒義：latin 不收裸 cristal（香檳同名），cjk 水晶（巴） */
  { slug: "antarctica-original", latin: ["antarctica"], cjk: ["南极洲", "南極洲"] },
  { slug: "itaipava-pilsen", latin: ["itaipava"], cjk: ["伊泰帕瓦"] },
  { slug: "kaiser", latin: ["kaiser"], cjk: ["凱撒", "凯撒"] },
  { slug: "cristal", latin: ["cerveza cristal", "cristal beer", "cristal pilsen"], cjk: ["水晶"] },
  { slug: "quilmes-clasica", latin: ["quilmes"], cjk: ["基尔梅斯", "基爾梅斯"] },
  { slug: "andes-origen", latin: ["andes", "andes origen"], cjk: ["安第斯", "安第斯"] },
  { slug: "pace-a", latin: ["paceña", "pacena"], cjk: ["帕塞尼亚", "帕塞尼亞"] },
  { slug: "cusque-a-dorada", latin: ["cusqueña", "cusquena"], cjk: ["库斯科", "庫斯科"] },
  { slug: "pilsen-callao", latin: ["pilsen callao", "callao"], cjk: ["卡亚俄", "卡亞俄"] },
  { slug: "club-colombia-dorada", latin: ["club colombia"], cjk: ["哥伦比亚俱乐部", "哥倫比亞俱樂部"] },
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
