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

/** How long we wait for the browser geolocation before giving up. */
export const GEOLOCATION_TIMEOUT_MS = 10_000;
/** Accept a cached position up to this age to avoid re-prompting. */
export const GEOLOCATION_MAX_AGE_MS = 60_000;

/** Free CARTO Voyager raster tiles — no API key needed, attribution required. */
export const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
