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
