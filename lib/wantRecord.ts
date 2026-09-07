/**
 * UR1.8 想喝打卡快照 — localStorage 本地持久化（Web POC 水位；
 * native 阶段再议真方案，用户决策）。
 *
 * 落「想喝」瞬间存一条 {beer, at, position}，之后移动不再改动它；
 * 回看面板显示的即此快照。localStorage 内容不可信，一律经
 * parseWantRecord 校验才进 state。
 */

import type { Beer } from "./beers";
import type { LatLng } from "./geo";
import { haversineMeters } from "./geo";

/** Frozen the moment a 想喝 pin drops — never follows you afterwards. */
export type WantRecord = {
  beer: Beer;
  /** Epoch ms at drop time. */
  at: number;
  position: LatLng;
  /**
   * Reverse-geocoded place name (resolved async after the drop, patched
   * back into storage). Absent offline — the card falls back to coords.
   */
  placeName?: string;
};

export const WANT_STORAGE_KEY = "wtd-want-record";

function isLatLng(value: unknown): value is LatLng {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng)
  );
}

/** Pure validator — storage content is untrusted input. */
export function parseWantRecord(raw: unknown): WantRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const outer = raw as Record<string, unknown>;
  if (
    typeof outer.at !== "number" ||
    !Number.isFinite(outer.at) ||
    outer.at <= 0
  ) {
    return null;
  }
  if (!isLatLng(outer.position)) return null;
  const beer = outer.beer;
  if (typeof beer !== "object" || beer === null) return null;
  const candidate = beer as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.emoji !== "string" ||
    typeof candidate.name !== "string"
  ) {
    return null;
  }
  const record: WantRecord = {
    beer: {
      id: candidate.id,
      emoji: candidate.emoji,
      name: candidate.name,
      category:
        typeof candidate.category === "string" ? candidate.category : "",
      tagline: typeof candidate.tagline === "string" ? candidate.tagline : "",
    },
    at: outer.at,
    position: outer.position,
  };
  if (typeof outer.placeName === "string" && outer.placeName.length > 0) {
    record.placeName = outer.placeName;
  }
  return record;
}

export function loadWantRecord(): WantRecord | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(WANT_STORAGE_KEY);
    if (raw === null) return null;
    return parseWantRecord(JSON.parse(raw) as unknown);
  } catch {
    // Corrupt JSON / private mode — treat as no record, harmless.
    return null;
  }
}

export function saveWantRecord(record: WantRecord): void {
  try {
    window.localStorage.setItem(WANT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode — degrades to session-only, harmless.
  }
}

export function clearWantRecord(): void {
  try {
    window.localStorage.removeItem(WANT_STORAGE_KEY);
  } catch {
    // Nothing to clear anyway.
  }
}

/**
 * UR3.4 bug 修（加推荐酒清掉旧数据）：单槽改史槽。
 * - 新键 `wtd-want-history` 存数组（按 at 升序，上限截尾保最新）。
 * - 迁移：history 缺席但 legacy 单键在→收编为首条并删 legacy（旧存档零丢失）。
 * - 条目逐个过 parseWantRecord，坏条丢弃（UR1.8 口径）。
 */

/** 史槽上限：够画轨迹，又不让 localStorage 无限长。 */
export const MAX_WANT_HISTORY = 30;

export const WANT_HISTORY_KEY = "wtd-want-history";

/**
 * 同店半径（米）：新打卡落在这个距离内＝同一位置，顶掉旧条而非叠钉。
 * GPS 本来就有漂移，卡坐标百分百相等反而拦不住真重复。
 */
export const SAME_SPOT_M = 10;

/**
 * Pure upsert：同店（10m 内）顶替，无同店追加；结果按 at 升序＋截尾。
 * handleWant 唯一写入口（存储＋state 同调它）。
 */
export function upsertWantHistory(
  prev: readonly WantRecord[],
  record: WantRecord,
): WantRecord[] {
  const rest = prev.filter(
    (r) => haversineMeters(r.position, record.position) >= SAME_SPOT_M,
  );
  return [...rest, record]
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_WANT_HISTORY);
}

/**
 * UR3.7 纯换酒：按 at 换掉条目的 beer，时间／位置／地名原样保留
 * （pin 不动，只换酒）；对不上 at 原样返回。
 */
export function swapWantBeer(
  prev: readonly WantRecord[],
  at: number,
  beer: WantRecord["beer"],
): WantRecord[] {
  return prev.map((r) => (r.at === at ? { ...r, beer } : r));
}

/** UR3.7 纯删除：按 at 丢条目；调用方定删后看哪条／关卡。 */
export function removeWantAt(
  prev: readonly WantRecord[],
  at: number,
): WantRecord[] {
  return prev.filter((r) => r.at !== at);
}

/** Pure validator for the history array — bad entries are dropped. */
export function parseWantHistory(raw: unknown): WantRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: WantRecord[] = [];
  for (const item of raw) {
    const record = parseWantRecord(item);
    if (record !== null) out.push(record);
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(-MAX_WANT_HISTORY);
}

export function loadWantHistory(): WantRecord[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(WANT_HISTORY_KEY);
    if (raw !== null) return parseWantHistory(JSON.parse(raw) as unknown);
    // Legacy migration (one-time): single slot → history, then drop the key.
    const legacy = loadWantRecord();
    if (legacy === null) return [];
    const migrated = [legacy];
    saveWantHistory(migrated);
    clearWantRecord();
    return migrated;
  } catch {
    return [];
  }
}

export function saveWantHistory(records: readonly WantRecord[]): void {
  try {
    window.localStorage.setItem(
      WANT_HISTORY_KEY,
      JSON.stringify([...records].slice(-MAX_WANT_HISTORY)),
    );
  } catch {
    // Private mode — degrades to session-only, harmless.
  }
}

export function clearWantHistory(): void {
  try {
    window.localStorage.removeItem(WANT_HISTORY_KEY);
    window.localStorage.removeItem(WANT_STORAGE_KEY);
  } catch {
    // Nothing to clear anyway.
  }
}

/**
 * HK wall-clock full format, matched to the UI language (user decision):
 * Chinese → `2026年9月5日 14:32`, English → `2026-09-05 14:32`.
 * Built from formatToParts (timezone pinned to Asia/Hong_Kong, so output
 * never depends on the viewer's zone) instead of trusting each locale's
 * default date shape.
 */
export function formatWantTime(at: number, locale: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(at));
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");
  if (locale.startsWith("zh")) {
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  }
  const pad = (s: string): string => s.padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)} ${hour}:${minute}`;
}

/** Fallback coords display — what was stored is what you see. */
export function formatWantCoords(position: LatLng): string {
  return `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`;
}

/** Minimal Nominatim reverse-response shape (jsonv2 + addressdetails). */
export type ReverseGeocodeResult = {
  display_name?: string;
  address?: Record<string, string>;
};

/**
 * Human place name from a reverse-geocode response: road + district when
 * the address block has them, else the first display_name segment.
 * Pure — unit tested with fixtures.
 */
export function formatPlaceName(
  data: ReverseGeocodeResult,
  locale: string,
): string | null {
  const address = data.address;
  if (address !== undefined) {
    const road =
      address.road ??
      address.pedestrian ??
      address.footway ??
      address.cycleway;
    const district =
      address.suburb ??
      address.neighbourhood ??
      address.city_district ??
      address.quarter ??
      address.city ??
      address.town ??
      address.county;
    const parts = [road, district].filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    );
    if (parts.length > 0) {
      return parts.join(locale.startsWith("zh") ? "，" : ", ");
    }
  }
  if (typeof data.display_name === "string" && data.display_name.length > 0) {
    const first = data.display_name.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) return first;
  }
  return null;
}

/**
 * One reverse-geocode lookup per position (user decision: real place names
 * online, coords fallback offline). Free Nominatim, keyless like the OSM
 * tiles (same prototype-scale usage reasoning — browsers send Referer
 * automatically; one request per new drop, far under the 1 req/s policy).
 * Results are memoized per rounded position + language.
 */
const placeCache = new Map<string, string | null>();

export async function resolvePlaceName(
  position: LatLng,
  locale: string,
): Promise<string | null> {
  const lang = locale.startsWith("zh-Hans")
    ? "zh-CN"
    : locale.startsWith("zh")
      ? "zh-TW"
      : "en";
  const key = `${position.lat.toFixed(4)},${position.lng.toFixed(4)}:${lang}`;
  const cached = placeCache.get(key);
  if (cached !== undefined) return cached;
  let name: string | null = null;
  try {
    const url =
      "https://nominatim.openstreetmap.org/reverse" +
      `?format=jsonv2&lat=${position.lat}&lon=${position.lng}` +
      `&zoom=18&addressdetails=1&accept-language=${lang}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = (await response.json()) as ReverseGeocodeResult;
      name = formatPlaceName(data, locale);
    }
  } catch {
    // Offline / blocked — caller falls back to coords.
    name = null;
  }
  placeCache.set(key, name);
  return name;
}
