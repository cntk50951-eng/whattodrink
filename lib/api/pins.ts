/**
 * UR A.8 地图 Pins 公开 API — BBOX 解析 + 街区级模糊（纯函数，可单测）。
 * 模糊口径：截断至 3 位小数（约 100m 街区），原始值永不外泄。
 * BBOX 格式：west,south,east,north 逗号分隔，均为浮点，west<east 且 south<north，
 * 均在经纬度合法范围，且面积不大於 2deg²（防全图滥查；HK 全图约 0.27deg²，故正常 BBOX 均可过）。
 */

import { HK_BOUNDS } from "../geo";

export const PINS_DEFAULT_LIMIT = 100;
export const PINS_MAX_LIMIT = 200;
export const PINS_FUZZ_FACTOR = 1000; // 10^3 → 3位小数
export const PINS_MAX_BBOX_AREA = 2.0; // deg²

export type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type PinJson = {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  drinkName: string | null;
  drinkEmoji: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  checkedInAt: number; // epoch ms
  isOnline: boolean;
};

/** 截断至 3 位小数（非四舍五入），正负通用（trunc 行为）。 */
export function fuzzCoordinate(coord: number): number {
  return Math.trunc(coord * PINS_FUZZ_FACTOR) / PINS_FUZZ_FACTOR;
}

export function parseBbox(raw: string | null): { bbox: BBox } | { error: string } {
  if (raw === null || raw.trim() === "") {
    return { error: "bbox 必填：west,south,east,north 逗号分隔" };
  }
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 4) {
    return { error: "bbox 格式错误：需要 4 个浮点 west,south,east,north" };
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    return { error: "bbox 格式错误：含非数值" };
  }
  const [west, south, east, north] = nums as [number, number, number, number];
  if (west >= east || south >= north) {
    return { error: "bbox 方向错误：需 west<east 且 south<north" };
  }
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return { error: "bbox 越界：经度 -180~180，纬度 -90~90" };
  }
  const area = (east - west) * (north - south);
  if (area > PINS_MAX_BBOX_AREA) {
    return { error: `bbox 面积超限：${area.toFixed(2)}deg² > ${PINS_MAX_BBOX_AREA}deg²` };
  }
  // 额外：HK 全图外的大面积 BBOX 也拦（防全表扫），但小 BBOX 即使在 HK 外也放行（空结果即可）
  // 此处已由面积上限覆盖，HK 外的小 BBOX 会正常查询后返回 []
  return { bbox: { west, south, east, north } };
}

export function parsePinsParams(search: URLSearchParams): { bbox: BBox; limit: number } | { error: string } {
  const bboxResult = parseBbox(search.get("bbox"));
  if ("error" in bboxResult) return bboxResult;
  const limitRaw = search.get("limit");
  const limit = limitRaw === null ? PINS_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > PINS_MAX_LIMIT) {
    return { error: `limit 非法：${limitRaw ?? ""}（要 1-${PINS_MAX_LIMIT} 整数）` };
  }
  return { bbox: bboxResult.bbox, limit };
}

/** 行级校验 + 模糊：DB 行 -> PinJson 或 null（坏行跳过）。 */
export function toPinJson(raw: unknown, nowMs: number = Date.now()): PinJson | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const lat = typeof r.lat === "number" && Number.isFinite(r.lat) ? r.lat : null;
  const lng = typeof r.lng === "number" && Number.isFinite(r.lng) ? r.lng : null;
  const placeName = typeof r.place_name === "string" ? r.place_name : r.place_name === null ? null : null;
  const createdAtRaw = typeof r.created_at === "string" ? r.created_at : null;
  if (id === null || lat === null || lng === null || createdAtRaw === null) return null;
  const checkedInAt = Date.parse(createdAtRaw);
  if (!Number.isFinite(checkedInAt)) return null;

  // users join（可能 null：已删号）
  const users = r.users as unknown;
  let nickname: string | null = null;
  let avatarUrl: string | null = null;
  let gender: string | null = null;
  let lastSeenAt: string | null = null;
  if (users !== null && typeof users === "object") {
    const u = users as Record<string, unknown>;
    nickname = typeof u.nickname === "string" ? u.nickname : null;
    avatarUrl = typeof u.avatar_url === "string" ? u.avatar_url : u.avatar_url === null ? null : null;
    gender = typeof u.gender === "string" ? u.gender : null;
    lastSeenAt = typeof u.last_seen_at === "string" ? u.last_seen_at : null;
  }

  // beers join（可能 null）
  const beers = r.beers as unknown;
  let drinkName: string | null = null;
  let drinkEmoji: string | null = null;
  if (beers !== null && typeof beers === "object") {
    const b = beers as Record<string, unknown>;
    drinkName = typeof b.name === "string" ? b.name : null;
    drinkEmoji = typeof b.emoji === "string" ? b.emoji : null;
  }

  const isOnline = (() => {
    if (lastSeenAt === null) return false;
    const ts = Date.parse(lastSeenAt);
    if (!Number.isFinite(ts)) return false;
    return nowMs - ts < 5 * 60_000;
  })();

  // area 取 place_name，空则回 null（前端可退 HK_BOUNDS 中心文案）
  const area = placeName;

  // 模糊坐标：原始值永不外泄
  const fuzzedLat = fuzzCoordinate(lat);
  const fuzzedLng = fuzzCoordinate(lng);

  // 校验模糊后仍为有限数
  if (!Number.isFinite(fuzzedLat) || !Number.isFinite(fuzzedLng)) return null;

  return {
    id,
    lat: fuzzedLat,
    lng: fuzzedLng,
    area,
    drinkName,
    drinkEmoji,
    nickname,
    avatarUrl,
    gender,
    checkedInAt,
    isOnline,
  };
}

// 辅助：判断 BBOX 是否与 HK 有交集（可选优化，非必需，前端传 HK 内 BBOX 即可）
// 保留 HK_BOUNDS 引用以显式关联地理常量（coding-standards：Magic numbers 抽常数）
export function isBboxOverlapsHK(bbox: BBox): boolean {
  return !(
    bbox.east < HK_BOUNDS.west ||
    bbox.west > HK_BOUNDS.east ||
    bbox.north < HK_BOUNDS.south ||
    bbox.south > HK_BOUNDS.north
  );
}
