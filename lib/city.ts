import { isWithinHongKong, type LatLng } from "./geo";

/**
 * UR3.5+ 城市图标管线：一线城市码＋判定＋资源路径。
 * 判定只吃真实数据源（GPS bounds＋Nominatim 区名），无命中回 null，
 * 调用方回退 Building2——禁编造城市（UR3.4 mock 教训）。
 * 资源是 `public/city-icons/<code>.svg`（64 格手绘，见 docs/city-icons.md）。
 */
export const CITY_CODES = ["hk", "bj", "sh", "gz", "sz"] as const;

export type CityCode = (typeof CITY_CODES)[number];

const AREA_MATCH: ReadonlyArray<{
  code: CityCode;
  names: ReadonlyArray<string>;
}> = [
  { code: "hk", names: ["香港", "hong kong"] },
  { code: "bj", names: ["北京", "beijing"] },
  { code: "sh", names: ["上海", "shanghai"] },
  { code: "gz", names: ["广州", "廣州", "guangzhou"] },
  { code: "sz", names: ["深圳", "shenzhen"] },
];

/** GPS 在港 bounds 内即 hk；否则按区名字串命中一线城市；都无即 null。 */
export function resolveCityCode(
  position: LatLng | null,
  area: string | null,
): CityCode | null {
  if (position !== null && isWithinHongKong(position)) return "hk";
  if (area !== null) {
    const hay = area.toLowerCase();
    for (const { code, names } of AREA_MATCH) {
      if (names.some((name) => hay.includes(name))) return code;
    }
  }
  return null;
}

/** 按需加载：只有左上卡片解析出城市码时才请求这一枚 SVG。 */
export function cityIconSrc(code: CityCode): string {
  return `/city-icons/${code}.svg`;
}
