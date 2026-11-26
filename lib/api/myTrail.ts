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

type TrailSeqRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * 足跡全局序號（DEF-20261125-035，0092）：回傳 id→第幾站（由舊到新 1-based）與本人足跡總數。
 * fail-soft：RPC 未部署／失敗／回包不對時回空表、total null，路由照常回列表（客戶端退回本地序號）。
 */
export async function readTrailSeq(
  client: TrailSeqRpc,
  ids: readonly string[],
): Promise<{ seq: Map<string, number>; total: number | null }> {
  const seq = new Map<string, number>();
  if (ids.length === 0) return { seq, total: null };
  try {
    const { data, error } = await client.rpc("my_checkin_trail_seq", { p_ids: ids });
    if (error !== null && error !== undefined) {
      console.error("[myTrail] seq read failed:", error);
      return { seq, total: null };
    }
    let total: number | null = null;
    for (const row of Array.isArray(data) ? data : []) {
      const r = row as { id?: unknown; seq?: unknown; total?: unknown };
      const n = Number(r.seq);
      const t = Number(r.total);
      if (typeof r.id !== "string" || !Number.isInteger(n) || n < 1) continue;
      seq.set(r.id, n);
      if (Number.isInteger(t) && t >= n) total = t;
    }
    return { seq, total };
  } catch (err) {
    console.error("[myTrail] seq read threw:", err);
    return { seq, total: null };
  }
}
