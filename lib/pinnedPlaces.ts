/**
 * UR G.9 我的地點（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `PinnedPlace.swift`（10m 去重＋100 上限＋新在前＋按帳號分桶，本文件只做純邏輯）。
 */

export type PinnedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  createdAt: number;
  sourceCheckinId: string | null;
};

/** 約 10m（緯度 1° ≈ 111km → 0.0001° ≈ 11m；iOS samePlaceDelta 口徑）。 */
export const SAME_PLACE_DELTA = 0.0001;
export const PINNED_MAX = 100;

export function isSamePlace(a: PinnedPlace, lat: number, lng: number): boolean {
  return Math.abs(a.lat - lat) < SAME_PLACE_DELTA && Math.abs(a.lng - lng) < SAME_PLACE_DELTA;
}

export function findPinned(list: PinnedPlace[], lat: number, lng: number): PinnedPlace | null {
  return list.find((p) => isSamePlace(p, lat, lng)) ?? null;
}

/** 加入（已存在原樣回；超上限擠最舊；新在最前）。 */
export function addPinned(place: PinnedPlace, list: PinnedPlace[]): PinnedPlace[] {
  if (findPinned(list, place.lat, place.lng) !== null) return list;
  const out = [place, ...list];
  return out.length > PINNED_MAX ? out.slice(0, PINNED_MAX) : out;
}

export function removePinned(id: string, list: PinnedPlace[]): PinnedPlace[] {
  return list.filter((p) => p.id !== id);
}

function isPinnedPlace(r: unknown): r is PinnedPlace {
  if (typeof r !== "object" || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.lat === "number" &&
    Number.isFinite(o.lat) &&
    typeof o.lng === "number" &&
    Number.isFinite(o.lng) &&
    typeof o.createdAt === "number"
  );
}

/** 反序列化（壞條過濾；iOS 無此層，web localStorage 脏數據自保）。 */
export function parsePinnedList(raw: unknown): PinnedPlace[] {
  let arr: unknown = raw;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(isPinnedPlace)
    .map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      createdAt: p.createdAt,
      sourceCheckinId: typeof (p as Record<string, unknown>).sourceCheckinId === "string" ? ((p as Record<string, unknown>).sourceCheckinId as string) : null,
    }))
    .slice(0, PINNED_MAX);
}

export function pinnedKey(uid: string | null): string {
  return `wtd-pinned-places.v1.${uid ?? "anon"}`;
}
