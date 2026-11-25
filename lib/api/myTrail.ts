import { parseCompositeCursor } from "./compositeCursor";

export const MY_TRAIL_HEADERS = { "Cache-Control": "private, no-store" };

type TrailBoundaries = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function parseTrailBounds(raw: string): TrailBoundaries | null {
  const parts = raw.split(",");
  if (parts.length !== 4 || parts.some((part) => part.trim() === "")) return null;
  const [west, south, east, north] = parts.map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (west < -180 || west > 180 || east < -180 || east > 180) return null;
  if (south < -90 || north > 90 || south > north) return null;
  return { west, south, east, north };
}

export function parseMyTrailList(search: URLSearchParams) {
  const limit = Number(search.get("limit") ?? "30");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return null;

  const rawCursor = search.get("cursor");
  const cursor = parseCompositeCursor(rawCursor);
  if (rawCursor !== null && (cursor === null || !Number.isFinite(Date.parse(cursor.createdAt)))) {
    return null;
  }

  const rawBounds = search.get("bbox");
  const bounds = rawBounds === null ? null : parseTrailBounds(rawBounds);
  if (rawBounds !== null && bounds === null) return null;
  return { limit, cursor, bounds };
}

export function parseMyTrailMap(search: URLSearchParams) {
  const rawBounds = search.get("bbox");
  const rawZoom = search.get("zoom");
  if (rawBounds === null || rawZoom === null || rawZoom.trim() === "") return null;
  const bounds = parseTrailBounds(rawBounds);
  if (bounds === null || bounds.south === bounds.north || bounds.west === bounds.east ||
      (bounds.west === 180 && bounds.east === -180)) return null;
  const zoom = Number(rawZoom);
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) return null;
  return { bounds, zoom };
}

export function trailBoundsArgs(bounds: TrailBoundaries | null) {
  return {
    p_west: bounds?.west ?? null,
    p_south: bounds?.south ?? null,
    p_east: bounds?.east ?? null,
    p_north: bounds?.north ?? null,
  };
}
