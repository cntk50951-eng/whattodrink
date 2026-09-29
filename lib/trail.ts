/**
 * UR3.4 我的足迹数据源（返工后口径）。
 *
 * - 足迹＝我自己的打卡，不是别人的，更不是编的 mock 站。
 *   现在只有一枚：当前的想喝钉（`wantRecord`，localStorage）。
 * - 以后打卡多了就是列表（`checkins where user_id＝我`），本函数原样 work。
 */

import type { LatLng } from "./geo";
import type { WantRecord } from "./wantRecord";
import { parseWantHistory } from "./wantRecord";
import { groupByAnchor, groupByCity, groupByCountry } from "./geoAreas";

export type TrailStop = {
  id: string;
  beerId: string;
  beerName: string;
  at: number;
  position: LatLng;
  placeName: string;
};

/**
 * UR C.11 round-8：足跡開關會話持久化（共享 dev server HMR／手動重載不斷流；
 * tab 級 sessionStorage，新訪問默認全關；隱私模式寫入失敗吞掉不中斷體驗）。
 */
export const TRAIL_ON_KEY = "wtd-trail-on";
export const STOPS_OPEN_KEY = "wtd-stops-open";

export function readTrailFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeTrailFlag(key: string, on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    // 見上：無持久化不中斷體驗
  }
}
/**
 * 想喝史→足迹站（无记录即无足迹，不编数据；防脏读再过一次校验＋排序，
 * 和存储层同一口径）。
 */
export function trailStops(records: readonly WantRecord[]): TrailStop[] {
  return parseWantHistory([...records]).map((record) => ({
    id: `want-${record.at}`,
    // UR E.3：无酒足迹站用空串占位（下游只做展示／分组键，不寻目录）。
    beerId: record.beer?.id ?? "",
    beerName: record.beer?.name ?? "",
    at: record.at,
    position: record.position,
    placeName: record.placeName ?? "",
  }));
}

export type FootStep = {
  lat: number;
  lng: number;
  /** 朝向度數（方位角；調用方轉 SVG rotate）。 */
  angle: number;
  /** 全局步序（調用方取模排動畫 delay）。 */
  step: number;
};

/**
 * UR C.11 round-6：相鄰站之間插腳印（按輸入順＝時間順；左右交替由 step 奇偶；
 * 每段 perLeg 枚、總量 cap 封頂，釘海不炸 DOM）。
 * round-12 訂正：不斷任何腿——交替跨區（HK／美國）數據下，50km 斷腿會吃掉
 * 全部腿致零腳印（DEF-002 確診）；跨洋點線本身即旅程信息，不隱藏。
 */
export function interpolateFootprints(
  stops: readonly { lat: number; lng: number }[],
  perLeg = 4,
  cap = 48,
): FootStep[] {
  if (stops.length < 2 || perLeg <= 0 || cap <= 0) return [];
  const per = Math.max(
    1,
    Math.min(perLeg, Math.floor(cap / (stops.length - 1))),
  );
  const out: FootStep[] = [];
  let step = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i] as { lat: number; lng: number };
    const b = stops[i + 1] as { lat: number; lng: number };
    const angle = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
    for (let k = 1; k <= per && out.length < cap; k++) {
      const t = k / (per + 1);
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        angle,
        step: step++,
      });
    }
  }
  return out;
}

/**
 * UR C.13 區域足跡腳印（跨地区时只显示跨地区段，区内不显示；减少数量，灰色）。
 * - 全局按 at 排序，连续不分断
 * - 若跨国家/城市/区，则仅在跨区段插脚印（区内不插），保证跨地区可见且不拥挤
 * - perLeg 2、cap 20，减少数量，有走动效果即可
 */
export function footprintsByArea(
  stops: readonly TrailStop[],
  perLeg = 2,
  cap = 20,
): FootStep[] {
  if (stops.length < 2 || perLeg <= 0 || cap <= 0) return [];
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const points = sorted.map((s) => s.position);
  // 判定层级：国家>城市>区
  const countryGroups = groupByCountry(points);
  const cityGroups = groupByCity(points);
  const anchorGroups = groupByAnchor(points);
  let level: "country" | "city" | "anchor" = "anchor";
  if (countryGroups.length > 1) level = "country";
  else if (cityGroups.length > 1) level = "city";
  else if (anchorGroups.length > 1) level = "anchor";
  else {
    // 单区单点，无跨区，仍按全局插少量
    return interpolateFootprints(points, perLeg, cap);
  }
  // 仅在跨区段插脚印
  const out: FootStep[] = [];
  let step = 0;
  for (let i = 0; i < sorted.length - 1 && out.length < cap; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    let sameRegion = false;
    if (level === "country") {
      const ca = groupByCountry([a.position])[0]?.country;
      const cb = groupByCountry([b.position])[0]?.country;
      sameRegion = ca === cb;
    } else if (level === "city") {
      const ca = groupByCity([a.position])[0]?.city;
      const cb = groupByCity([b.position])[0]?.city;
      sameRegion = ca === cb;
    } else {
      const aa = groupByAnchor([a.position])[0]?.anchor.id;
      const ab = groupByAnchor([b.position])[0]?.anchor.id;
      sameRegion = aa === ab;
    }
    if (sameRegion) continue;
    const angle = (Math.atan2(b.position.lng - a.position.lng, b.position.lat - a.position.lat) * 180) / Math.PI;
    const per = Math.min(perLeg, Math.floor((cap - out.length) / 1) || 1);
    for (let k = 1; k <= per && out.length < cap; k++) {
      const t = k / (per + 1);
      out.push({
        lat: a.position.lat + (b.position.lat - a.position.lat) * t,
        lng: a.position.lng + (b.position.lng - a.position.lng) * t,
        angle,
        step: step++,
      });
    }
  }
  // 若跨区段为 0（如 2 点同区），退回全局少量
  if (out.length === 0) {
    return interpolateFootprints(points, perLeg, cap);
  }
  return out;
}

/**
 * UR C.11：登入續跑參數——`/v2?trail=1` 落地即開足跡（沿 C.7 深鏈口徑）。
 * 純函數可單測；讀完即清參數防重觸（調用方職責）。
 */
export function parseTrailResume(search: string | null | undefined): boolean {
  if (search === null || search === undefined || search === "") return false;
  const q = search.startsWith("?") ? search : `?${search}`;
  try {
    return new URLSearchParams(q).get("trail") === "1";
  } catch {
    return false;
  }
}
