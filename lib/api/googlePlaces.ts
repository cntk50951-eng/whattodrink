import { DEFAULT_CENTER, haversineMeters, isWithinHongKong } from "../geo";
import type { LatLng } from "../geo";

/**
 * Google Maps Platform server-side proxy helpers (Places API New + Geocoding API).
 *
 * Cost & compliance guardrails:
 * 1. Strict X-Goog-FieldMask: Pro SKU fields only (NO photos / reviews / nationalPhoneNumber Enterprise fields).
 * 2. In-memory 15-min LRU grid cache (~110m cell) to cut repeated hotspot queries by 70-90%.
 * 3. Hard daily request cap (default 150 Places / 300 Geocode per UTC day, overrideable via env).
 *    When cap is reached, returns null so callers degrade smoothly to Amap / Nominatim.
 * 4. Routing boundary: Hong Kong / Macau / Taiwan / Overseas -> Google first; Mainland China -> Amap first.
 */

export type GoogleAroundKind = "bar" | "store";

export type NormalizedAroundPlace = {
  id: string;
  name: string;
  address: string;
  tel: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  kind: GoogleAroundKind;
};

export type NormalizedSearchPlace = {
  place_id: string;
  display_name: string;
  name: string;
  address: string;
  lat: string;
  lon: string;
  category: string;
  source: "google";
};

export type NormalizedReverseResult = {
  display_name: string;
  lat: string;
  lon: string;
  source: "google";
};

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const PLACES_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/** Pro-tier only field masks (never include photos, reviews, nationalPhoneNumber, or atmosphere). */
export const NEARBY_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location";
export const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType";

const INCLUDED_TYPES_BY_KIND: Record<GoogleAroundKind, readonly string[]> = {
  bar: ["bar", "pub", "wine_bar", "night_club"],
  store: ["convenience_store", "liquor_store"],
};

const DEFAULT_PLACES_DAILY_CAP = 150;
const DEFAULT_GEOCODE_DAILY_CAP = 300;
const CACHE_TTL_MS = 15 * 60_000;
const CACHE_MAX_ENTRIES = 300;
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Whether a WGS-84 coordinate falls inside Mainland China (excluding HK, Macau, Taiwan).
 * Used for provider routing: Mainland China -> Amap first; HK / Macau / Taiwan / Overseas -> Google first.
 */
export function isMainlandChina(point: LatLng): boolean {
  const { lat, lng } = point;
  if (isWithinHongKong(point)) return false;
  // Macau bounding box
  if (lat >= 22.1 && lat <= 22.22 && lng >= 113.52 && lng <= 113.6) return false;
  // Taiwan main & surrounding islands
  if (lat >= 21.85 && lat <= 25.35 && lng >= 119.3 && lng <= 122.1) return false;
  // Coarse Mainland China bounding box
  return lat >= 18.1 && lat <= 53.6 && lng >= 73.5 && lng <= 135.1;
}

export function readGoogleServerKey(): string | null {
  const raw = process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ?? "";
  return raw !== "" ? raw : null;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isInteger(raw) && raw > 0 ? raw : fallback;
}

/** Round lat/lng to 3 decimal places (~110m grid) for cache key deduplication. */
export function gridKey(lat: number, lng: number, suffix = ""): string {
  const rLat = lat.toFixed(3);
  const rLng = lng.toFixed(3);
  return suffix ? `${rLat},${rLng}:${suffix}` : `${rLat},${rLng}`;
}

export class DailyQuotaGuard {
  private day = "";
  private count = 0;

  constructor(private readonly getCap: () => number) {}

  tryConsume(now: Date = new Date()): boolean {
    const today = now.toISOString().slice(0, 10);
    if (this.day !== today) {
      this.day = today;
      this.count = 0;
    }
    const cap = this.getCap();
    if (this.count >= cap) return false;
    this.count += 1;
    return true;
  }

  getUsedToday(now: Date = new Date()): number {
    const today = now.toISOString().slice(0, 10);
    return this.day === today ? this.count : 0;
  }

  reset(): void {
    this.day = "";
    this.count = 0;
  }
}

export class LruTtlCache<T> {
  private readonly store = new Map<string, { ts: number; value: T }>();

  constructor(
    private readonly ttlMs: number = CACHE_TTL_MS,
    private readonly maxEntries: number = CACHE_MAX_ENTRIES,
  ) {}

  get(key: string, now: number = Date.now()): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (now - hit.ts > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    // Refresh recency
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    if (this.store.has(key)) this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    this.store.set(key, { ts: now, value });
  }

  clear(): void {
    this.store.clear();
  }
}

const placesQuota = new DailyQuotaGuard(() =>
  readPositiveIntEnv("GOOGLE_PLACES_DAILY_CAP", DEFAULT_PLACES_DAILY_CAP),
);
const geocodeQuota = new DailyQuotaGuard(() =>
  readPositiveIntEnv("GOOGLE_GEOCODE_DAILY_CAP", DEFAULT_GEOCODE_DAILY_CAP),
);

const nearbyCache = new LruTtlCache<NormalizedAroundPlace[]>();
const textCache = new LruTtlCache<NormalizedSearchPlace[]>();
const reverseCache = new LruTtlCache<NormalizedReverseResult>();

/** Test helper to clear module-level caches and daily counters. */
export function _resetGooglePlacesStateForTest(): void {
  placesQuota.reset();
  geocodeQuota.reset();
  nearbyCache.clear();
  textCache.clear();
  reverseCache.clear();
}

type GooglePlaceItem = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text || text.trimStart().startsWith("<")) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function sanitizePlaceId(raw: string): string {
  // Guard against resource names like "places/ChIJ..." -> keep only the ID segment
  const stripped = raw.startsWith("places/") ? raw.slice("places/".length) : raw;
  return stripped.slice(0, 64);
}

/**
 * Search nearby bars or convenience stores via Google Places API (New) searchNearby.
 * Returns null if quota cap is reached or request fails (caller may fallback).
 */
export async function googleNearbySearch(params: {
  key: string;
  lat: number;
  lng: number;
  radius: number;
  kind: GoogleAroundKind;
  languageCode?: string;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedAroundPlace[] | null> {
  const { key, lat, lng, radius, kind, languageCode = "zh-HK", fetchImpl = fetch } = params;
  const cKey = gridKey(lat, lng, `${kind}:${radius}:${languageCode}`);
  const cached = nearbyCache.get(cKey);
  if (cached !== null) return cached;

  if (!placesQuota.tryConsume()) {
    console.warn("[googlePlaces] daily places quota cap reached; falling back");
    return null;
  }

  try {
    const res = await fetchImpl(PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": NEARBY_FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: INCLUDED_TYPES_BY_KIND[kind],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        languageCode,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      await res.text().catch(() => {});
      return null;
    }

    const json = await safeJson<{ places?: GooglePlaceItem[] }>(res);
    const rawPlaces = Array.isArray(json?.places) ? json.places : [];
    const origin: LatLng = { lat, lng };
    const normalized: NormalizedAroundPlace[] = [];

    for (const p of rawPlaces) {
      const id = typeof p.id === "string" ? sanitizePlaceId(p.id) : "";
      const name = typeof p.displayName?.text === "string" ? p.displayName.text.trim() : "";
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      if (!id || !name || typeof plat !== "number" || typeof plng !== "number") continue;
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const dist = Math.round(haversineMeters(origin, { lat: plat, lng: plng }));
      normalized.push({
        id,
        name,
        address: typeof p.formattedAddress === "string" ? p.formattedAddress : "",
        tel: null,
        lat: plat,
        lng: plng,
        distance_m: Number.isFinite(dist) ? dist : null,
        kind,
      });
    }

    normalized.sort((a, b) => (a.distance_m ?? Number.MAX_SAFE_INTEGER) - (b.distance_m ?? Number.MAX_SAFE_INTEGER));
    nearbyCache.set(cKey, normalized);
    return normalized;
  } catch (e) {
    console.error(`[googlePlaces] searchNearby error: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }
}

/**
 * Search places by text query via Google Places API (New) searchText.
 * Supports optional WGS-84 locationBias (defaults to Hong Kong Central when omitted).
 */
export async function googleTextSearch(params: {
  key: string;
  query: string;
  bias?: LatLng;
  languageCode?: string;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedSearchPlace[] | null> {
  const { key, query, bias = DEFAULT_CENTER, languageCode = "zh-HK", fetchImpl = fetch } = params;
  const cKey = `${query.toLowerCase()}@${gridKey(bias.lat, bias.lng, languageCode)}`;
  const cached = textCache.get(cKey);
  if (cached !== null) return cached;

  if (!placesQuota.tryConsume()) {
    console.warn("[googlePlaces] daily places quota cap reached; falling back");
    return null;
  }

  try {
    const res = await fetchImpl(PLACES_TEXT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 8,
        languageCode,
        locationBias: {
          circle: {
            center: { latitude: bias.lat, longitude: bias.lng },
            radius: 50_000,
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      await res.text().catch(() => {});
      return null;
    }

    const json = await safeJson<{ places?: GooglePlaceItem[] }>(res);
    const rawPlaces = Array.isArray(json?.places) ? json.places : [];
    const normalized: NormalizedSearchPlace[] = [];

    for (const p of rawPlaces) {
      const id = typeof p.id === "string" ? sanitizePlaceId(p.id) : "";
      const name = typeof p.displayName?.text === "string" ? p.displayName.text.trim() : "";
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      if (!id || !name || typeof plat !== "number" || typeof plng !== "number") continue;
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      const address = typeof p.formattedAddress === "string" ? p.formattedAddress : "";
      normalized.push({
        place_id: id,
        display_name: address ? `${name} · ${address}` : name,
        name,
        address,
        lat: String(plat),
        lon: String(plng),
        category: typeof p.primaryType === "string" ? p.primaryType : "",
        source: "google",
      });
    }

    textCache.set(cKey, normalized);
    return normalized;
  } catch (e) {
    console.error(`[googlePlaces] searchText error: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }
}

/**
 * Reverse geocode a WGS-84 coordinate via Google Geocoding API.
 */
export async function googleReverseGeocode(params: {
  key: string;
  lat: number;
  lng: number;
  language?: string;
  fetchImpl?: typeof fetch;
}): Promise<NormalizedReverseResult | null> {
  const { key, lat, lng, language = "zh-HK", fetchImpl = fetch } = params;
  const cKey = gridKey(lat, lng, language);
  const cached = reverseCache.get(cKey);
  if (cached !== null) return cached;

  if (!geocodeQuota.tryConsume()) {
    console.warn("[googlePlaces] daily geocode quota cap reached; falling back");
    return null;
  }

  try {
    const url =
      `${GEOCODE_URL}?latlng=${encodeURIComponent(`${lat},${lng}`)}` +
      `&language=${encodeURIComponent(language)}&key=${encodeURIComponent(key)}`;
    const res = await fetchImpl(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      await res.text().catch(() => {});
      return null;
    }

    const json = await safeJson<{
      status?: string;
      results?: Array<{ formatted_address?: string }>;
    }>(res);

    if (json?.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }
    const addr = json.results[0]?.formatted_address?.trim();
    if (!addr) return null;

    const result: NormalizedReverseResult = {
      display_name: addr,
      lat: String(lat),
      lon: String(lng),
      source: "google",
    };
    reverseCache.set(cKey, result);
    return result;
  } catch (e) {
    console.error(`[googlePlaces] reverseGeocode error: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  }
}
