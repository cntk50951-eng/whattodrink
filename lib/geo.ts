/**
 * Hong Kong geo constants + pure helpers for the drink map (UR1.1).
 *
 * All values are plain data so they are trivially unit testable.
 * Leaflet itself is only touched inside the client map component.
 */

export type LatLng = {
  lat: number;
  lng: number;
};

/** Fallback centre — Central, Hong Kong Island. Used when geolocation fails. */
export const DEFAULT_CENTER: LatLng = { lat: 22.2819, lng: 114.1577 };

/** Loose bounding box around all of Hong Kong (UR1.1 task 3: zoom to whole HK). */
export const HK_BOUNDS = {
  south: 22.15,
  north: 22.58,
  west: 113.83,
  east: 114.44,
} as const;

export const ZOOM_DEFAULT = 13;
export const ZOOM_HK_WIDE = 11;
export const ZOOM_MIN = 10;
export const ZOOM_MAX = 18;

/**
 * How long we wait for the browser geolocation before giving up.
 * 15s: desktop fails fast enough, mobile cold fixes get a fair chance.
 */
export const GEOLOCATION_TIMEOUT_MS = 15_000;
/** Accept a cached position up to this age to avoid re-prompting. */
export const GEOLOCATION_MAX_AGE_MS = 60_000;

/**
 * Tile providers (UR1.1).
 *
 * Tile providers (UR1.1).
 *
 * Active: OSM standard raster (keyless — see below).
 *
 * Dormant alternative: Stadia Stamen Watercolor — hand-painted raster.
 * Needs a free `NEXT_PUBLIC_STADIA_KEY`; renders natively to z16.
 * Re-activate if PM ever wants the watercolor look (builder + attribution
 * kept, both unit tested).
 */
export const STADIA_MAX_NATIVE_ZOOM = 16;

export const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Pure builder — unit tested. Key is interpolated, never defaulted. */
export function stadiaTileUrl(apiKey: string): string {
  return `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=${apiKey}`;
}

/**
 * Primary: OSM standard raster — keyless, no signup, colourful streets /
 * water / parks out of the box. Browsers send Referer/User-Agent
 * automatically (required by the OSM Tile Usage Policy). Prototype-scale
 * use is fine; self-host tiles if traffic ever grows teeth.
 * Serves natively past z19.
 */
export const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const OSM_MAX_NATIVE_ZOOM = 19;

/**
 * Whether a point falls inside the Hong Kong bounding box.
 * Used to decide: fly to the user vs. show the HK-wide view with a note.
 */
export function isWithinHongKong(point: LatLng): boolean {
  return (
    point.lat >= HK_BOUNDS.south &&
    point.lat <= HK_BOUNDS.north &&
    point.lng >= HK_BOUNDS.west &&
    point.lng <= HK_BOUNDS.east
  );
}

/** Mean Earth radius in metres, for the haversine below. */
export const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle distance between two points (haversine, UR1.6).
 * Pure — the cheers card calls this at render time from the live watch
 * position, so the shown distance stays real and dynamic with no extra
 * state and no re-computation machinery.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** At/above this the card shows kilometres, below it metres. */
export const KM_THRESHOLD_M = 1000;
/**
 * Human distance for the cheers card: "350 m" / "2.3 km".
 * Units (m/km) travel unchanged across locales, so no i18n needed here.
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < KM_THRESHOLD_M) return `${Math.round(meters)} m`;
  return `${(meters / KM_THRESHOLD_M).toFixed(1)} km`;
}

/**
 * GCJ-02（高德）→ WGS-84（Leaflet／GPS）公开算法（UR G.4 附近页；高德 POI 全是 GCJ，
 * 直接画 OSM 上会偏；中国境外点原样回）。
 * 引用：标准 Krasovsky 椭球偏移式（eviltransform 同族）；单测锁往返＋境外恒等。
 */
const GCJ_A = 6_378_245;
const GCJ_EE = 0.00669342162296594323;

function gcjDelta(lat: number, lng: number): { dLat: number; dLng: number } {
  const rad = Math.PI / 180;
  const x = lng - 105;
  const y = lat - 35;
  let dLng =
    300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  dLng +=
    ((20 * Math.sin(6 * x * rad) + 20 * Math.sin(2 * x * rad)) * 2) / 3;
  dLng +=
    ((20 * Math.sin(x * rad) + 40 * Math.sin((x / 3) * rad)) * 2) / 3;
  dLng +=
    ((150 * Math.sin((x / 12) * rad) + 300 * Math.sin((x / 37) * rad)) * 2) / 3;
  let dLat =
    -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  dLat +=
    ((20 * Math.sin(6 * x * rad) + 20 * Math.sin(2 * x * rad)) * 2) / 3;
  dLat +=
    ((20 * Math.sin(y * rad) + 40 * Math.sin((y / 3) * rad)) * 2) / 3;
  dLat +=
    ((160 * Math.sin((y / 12) * rad) + 320 * Math.sin((y / 37) * rad)) * 2) / 3;
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { dLat, dLng };
}

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/** GCJ-02 → WGS-84（一次迭代，米级精度，附近页够用）。 */
export function gcj02ToWgs84(point: LatLng): LatLng {
  if (outOfChina(point.lat, point.lng)) return { ...point };
  const { dLat, dLng } = gcjDelta(point.lat, point.lng);
  return { lat: point.lat - dLat, lng: point.lng - dLng };
}

/** WGS-84 → GCJ-02（仅单测往返用；生产只用上行）。 */
export function wgs84ToGcj02(point: LatLng): LatLng {
  if (outOfChina(point.lat, point.lng)) return { ...point };
  const { dLat, dLng } = gcjDelta(point.lat, point.lng);
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

/**
 * 初始方位角（正北顺时针度数；雷达落点用，沿 iOS 方位距离口径）。
 * 同点回 0；纯数学（atan2），与 haversine 同椭球假设。
 */
export function initialBearing(a: LatLng, b: LatLng): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brg = (Math.atan2(y, x) * 180) / Math.PI;
  return (brg + 360) % 360;
}
