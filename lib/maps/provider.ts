/**
 * 地图底图 provider（UR C.8 试水：OSM ↔ 高德可切换＋自动回退）。
 *
 * Phase 1 只换瓦片源——Leaflet 照用，URL 在 OSM 与高德之间切：
 * - 开关：`NEXT_PUBLIC_MAP_PROVIDER=osm|amap`，缺省／非法一律 `osm`
 *   （行为与试水前一字不差，改回它即回退）。
 * - 自动回退：高德瓦片连续失败达阈值，组件侧拆层换 OSM（见 V2MapView）。
 *
 * 合规备注：直拼高德瓦片属试水（ToS 灰色，短期验证用）；
 * 转正必须走官方 JS API（Phase 2，另开 UR，需 Key）。
 */

import { OSM_ATTRIBUTION, OSM_MAX_NATIVE_ZOOM, OSM_URL } from "../geo";

export const MAP_PROVIDERS = ["osm", "amap"] as const;

/** 底图来源：`osm`＝OpenStreetMap raster（免 key），`amap`＝高德标准瓦片。 */
export type MapProvider = (typeof MAP_PROVIDERS)[number];

/** 缺省 provider——试水前行为，改回它即回退。 */
export const DEFAULT_MAP_PROVIDER: MapProvider = "osm";

/** env 解析：只有字面 `amap` 切高德，其余（缺省／空／非法）全回 `osm`。 */
export function parseMapProvider(raw: string | undefined): MapProvider {
  return raw === "amap" ? "amap" : "osm";
}

export type TileSpec = {
  url: string;
  attribution: string;
  maxNativeZoom: number;
  subdomains?: string[];
};

/**
 * 高德标准街道瓦片（style=8 矢量带注记，lang=zh_cn 中文，size=1 256px）。
 * 格式经多源现查确认（2026-09-27，见 UR C.8）；z<3 无数据
 * （本站 ZOOM_MIN=10，不受影响）。
 */
export const AMAP_TILE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";

export const AMAP_SUBDOMAINS = ["1", "2", "3", "4"] as const;

export const AMAP_ATTRIBUTION = "&copy; 高德地图 AutoNavi";

/** 高德瓦片原生到 z18（本站 maxZoom 取 geo 常数 ZOOM_MAX=18，不超限）。 */
export const AMAP_MAX_NATIVE_ZOOM = 18;

/** 高德瓦片连续失败几次触发自动回退（偶发一两块 404／超时不算数）。 */
export const TILE_FALLBACK_THRESHOLD = 5;

/** 纯函数——连续失败数达阈值即回 OSM（计数由调用方在 tileload 成功时清零）。 */
export function shouldFallbackToOsm(consecutiveErrors: number): boolean {
  return consecutiveErrors >= TILE_FALLBACK_THRESHOLD;
}

/** OSM 沿用 `lib/geo` 既有常数（行为与试水前一致）；amap 走高德模板。 */
export function tileSpecFor(provider: MapProvider): TileSpec {
  if (provider === "amap") {
    return {
      url: AMAP_TILE_URL,
      attribution: AMAP_ATTRIBUTION,
      maxNativeZoom: AMAP_MAX_NATIVE_ZOOM,
      subdomains: [...AMAP_SUBDOMAINS],
    };
  }
  return {
    url: OSM_URL,
    attribution: OSM_ATTRIBUTION,
    maxNativeZoom: OSM_MAX_NATIVE_ZOOM,
  };
}
