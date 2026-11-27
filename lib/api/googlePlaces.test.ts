import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetGooglePlacesStateForTest,
  DailyQuotaGuard,
  googleNearbySearch,
  googleReverseGeocode,
  googleTextSearch,
  gridKey,
  isMainlandChina,
  LruTtlCache,
  NEARBY_FIELD_MASK,
  TEXT_SEARCH_FIELD_MASK,
} from "./googlePlaces";

describe("isMainlandChina", () => {
  it("excludes Hong Kong, Macau, Taiwan, and overseas locations", () => {
    expect(isMainlandChina({ lat: 22.2819, lng: 114.1577 })).toBe(false); // Central HK
    expect(isMainlandChina({ lat: 22.1987, lng: 113.5439 })).toBe(false); // Macau
    expect(isMainlandChina({ lat: 25.033, lng: 121.5654 })).toBe(false); // Taipei
    expect(isMainlandChina({ lat: 37.323, lng: -122.0322 })).toBe(false); // Cupertino, US
    expect(isMainlandChina({ lat: 35.6762, lng: 139.6503 })).toBe(false); // Tokyo
  });

  it("identifies Mainland China cities", () => {
    expect(isMainlandChina({ lat: 31.2304, lng: 121.4737 })).toBe(true); // Shanghai
    expect(isMainlandChina({ lat: 39.9042, lng: 116.4074 })).toBe(true); // Beijing
    expect(isMainlandChina({ lat: 23.1291, lng: 113.2644 })).toBe(true); // Guangzhou
  });
});

describe("DailyQuotaGuard", () => {
  it("enforces daily cap and resets on next UTC day", () => {
    const guard = new DailyQuotaGuard(() => 2);
    const day1 = new Date("2026-11-27T10:00:00Z");
    const day2 = new Date("2026-11-28T00:01:00Z");

    expect(guard.tryConsume(day1)).toBe(true);
    expect(guard.tryConsume(day1)).toBe(true);
    expect(guard.tryConsume(day1)).toBe(false);
    expect(guard.getUsedToday(day1)).toBe(2);

    expect(guard.tryConsume(day2)).toBe(true);
    expect(guard.getUsedToday(day2)).toBe(1);
  });
});

describe("LruTtlCache & gridKey", () => {
  it("caches with TTL and LRU eviction", () => {
    const cache = new LruTtlCache<string>(1000, 2);
    cache.set("a", "1", 0);
    cache.set("b", "2", 100);
    expect(cache.get("a", 200)).toBe("1");
    cache.set("c", "3", 300); // evicts "b" because "a" was just refreshed
    expect(cache.get("b", 400)).toBeNull();
    expect(cache.get("a", 400)).toBe("1");
    expect(cache.get("a", 1200)).toBeNull(); // expired
  });

  it("rounds coordinates to 3 decimals (~110m grid)", () => {
    expect(gridKey(22.28194, 114.15771, "bar")).toBe("22.282,114.158:bar");
  });
});

describe("Google Places & Geocoding helpers", () => {
  beforeEach(() => {
    _resetGooglePlacesStateForTest();
  });

  it("never requests Enterprise fields in FieldMask", () => {
    for (const mask of [NEARBY_FIELD_MASK, TEXT_SEARCH_FIELD_MASK]) {
      expect(mask).not.toContain("photos");
      expect(mask).not.toContain("reviews");
      expect(mask).not.toContain("nationalPhoneNumber");
    }
  });

  it("normalizes nearby results, strips places/ prefix, computes distance, and caches", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/ChIJFarBar_1",
              displayName: { text: "Far Bar" },
              formattedAddress: "Central, HK",
              location: { latitude: 22.29, lng: undefined, longitude: 114.165 },
            },
            {
              id: "ChIJNearBar-2",
              displayName: { text: "Amber Room" },
              formattedAddress: "Lan Kwai Fong, Central",
              location: { latitude: 22.282, longitude: 114.158 },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const first = await googleNearbySearch({
      key: "test-key",
      lat: 22.2819,
      lng: 114.1577,
      radius: 3000,
      kind: "bar",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(first).not.toBeNull();
    expect(first).toHaveLength(2);
    // Sorted nearest first
    expect(first?.[0]?.id).toBe("ChIJNearBar-2");
    expect(first?.[0]?.name).toBe("Amber Room");
    expect(first?.[0]?.tel).toBeNull();
    expect(first?.[0]?.kind).toBe("bar");
    expect(first?.[1]?.id).toBe("ChIJFarBar_1"); // stripped "places/"

    // Second call on same ~110m grid hits cache without calling fetch again
    const second = await googleNearbySearch({
      key: "test-key",
      lat: 22.28192,
      lng: 114.15773,
      radius: 3000,
      kind: "bar",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("normalizes text search results to existing /api/v1/places/search contract", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJTest123",
              displayName: { text: "COA" },
              formattedAddress: "Shin Hing St, Central, Hong Kong",
              location: { latitude: 22.2837, longitude: 114.1525 },
              primaryType: "bar",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await googleTextSearch({
      key: "test-key",
      query: "COA",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res).toEqual([
      {
        place_id: "ChIJTest123",
        display_name: "COA · Shin Hing St, Central, Hong Kong",
        name: "COA",
        address: "Shin Hing St, Central, Hong Kong",
        lat: "22.2837",
        lon: "114.1525",
        category: "bar",
        source: "google",
      },
    ]);
  });

  it("normalizes reverse geocode and returns null on non-OK status", async () => {
    const okFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [{ formatted_address: "One Apple Park Way, Cupertino, CA, USA" }],
        }),
        { status: 200 },
      ),
    );

    const ok = await googleReverseGeocode({
      key: "test-key",
      lat: 37.3346,
      lng: -122.009,
      fetchImpl: okFetch as unknown as typeof fetch,
    });
    expect(ok).toEqual({
      display_name: "One Apple Park Way, Cupertino, CA, USA",
      lat: "37.3346",
      lon: "-122.009",
      source: "google",
    });

    const badFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), { status: 200 }),
    );
    const fail = await googleReverseGeocode({
      key: "test-key",
      lat: 0.001,
      lng: 0.001,
      fetchImpl: badFetch as unknown as typeof fetch,
    });
    expect(fail).toBeNull();
  });
});
