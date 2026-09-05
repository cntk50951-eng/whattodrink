/**
 * MOCK check-in seed data for the UR1.1 drink map prototype.
 *
 * ⚠️ Everything here is FAKE — placeholder avatars so the map feels alive
 * while there is no backend. EPIC 3 wires this up to Supabase; when that
 * lands, delete MOCK_CHECKINS and fetch real check-ins instead.
 * The map UI labels these entries with the i18n `map.mockNote` string.
 */

import type { LatLng } from "./geo";

export type Checkin = {
  /** Stable id. Real backend will use row UUIDs. */
  id: string;
  nickname: string;
  /** Drink emoji — matches the product's existing emoji language (lib/beers.ts). */
  drinkEmoji: string;
  drinkName: string;
  area: string;
  position: LatLng;
  cheers: number;
  /** Always true for seed data — lets the UI badge mock entries. */
  mock: true;
};

export const MOCK_CHECKINS: Checkin[] = [
  {
    id: "mock-cwb-01",
    nickname: "阿怡",
    drinkEmoji: "🍻",
    drinkName: "Asahi 生啤",
    area: "銅鑼灣",
    position: { lat: 22.2783, lng: 114.1827 },
    cheers: 12,
    mock: true,
  },
  {
    id: "mock-central-01",
    nickname: "Kelvin",
    drinkEmoji: "🥃",
    drinkName: "角嗨 Highball",
    area: "中環",
    position: { lat: 22.2819, lng: 114.1577 },
    cheers: 8,
    mock: true,
  },
  {
    id: "mock-tst-01",
    nickname: "Mandy",
    drinkEmoji: "🍹",
    drinkName: "Mojito",
    area: "尖沙咀",
    position: { lat: 22.2976, lng: 114.1722 },
    cheers: 21,
    mock: true,
  },
  {
    id: "mock-mk-01",
    nickname: "大佬明",
    drinkEmoji: "🍺",
    drinkName: "本地精釀 IPA",
    area: "旺角",
    position: { lat: 22.3193, lng: 114.1694 },
    cheers: 5,
    mock: true,
  },
];
