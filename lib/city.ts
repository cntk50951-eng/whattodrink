import type { LatLng } from "./geo";

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

const CITY_CENTERS: Record<CityCode, LatLng> = {
  hk: { lat: 22.28, lng: 114.15 },
  sz: { lat: 22.543, lng: 114.057 },
  gz: { lat: 23.129, lng: 113.264 },
  sh: { lat: 31.23, lng: 121.47 },
  bj: { lat: 39.9, lng: 116.4 },
};

/** GPS 最近城市（按中心距离，HK/SZ 重叠时以距离区分，避免 HK_BOUNDS 误判深圳为香港）。 */
export function cityOfCoords(position: LatLng): CityCode | null {
  let best: CityCode | null = null;
  let bestD = Infinity;
  for (const code of CITY_CODES) {
    const c = CITY_CENTERS[code];
    const dLat = position.lat - c.lat;
    const dLng = (position.lng - c.lng) * Math.cos((position.lat * Math.PI) / 180);
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = code;
    }
  }
  // 距离阈值：> 3 度（约 300km）视为无匹配（海外），返回 null
  if (bestD > 9) return null;
  return best;
}

/** GPS 在港 bounds 内即 hk；否则按区名字串命中一线城市；都无即 null。 */
export function resolveCityCode(
  position: LatLng | null,
  area: string | null,
): CityCode | null {
  if (position !== null) {
    const byCoords = cityOfCoords(position);
    if (byCoords !== null) return byCoords;
  }
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
