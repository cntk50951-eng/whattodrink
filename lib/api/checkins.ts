/**
 * UR A.10 打卡持久化 — `POST /api/v1/checkins` 入参校验 + `GET /api/v1/checkins/mine` 行映射（纯函数，可单测）。
 * `want` 打卡落库为 `type='want' + visibility='private'`，二次登录靠 `mine` 回显。
 * DB 行是不可信输入：逐行校验，坏行跳过（与 wall 同容错口径，见 lib/api/wall.ts）。
 */

import type { Beer } from "../beers";
import type { LatLng } from "../geo";
import type { WantRecord } from "../wantRecord";

export const CHECKINS_MINE_LIMIT = 30;
export const CHECKINS_MINE_MAX_LIMIT = 50;

export type CreateCheckinBody = {
  beer_id: string;
  lat: number;
  lng: number;
  place_name?: string | null;
  kind: "flash" | "post";
};

export type CreateCheckinJson = {
  checkin: {
    id: string;
    beer_id: string;
    lat: number;
    lng: number;
    place_name: string | null;
    kind: "flash" | "post";
    visibility: "private" | "public" | "friends";
    expires_at: string | null; // ISO，flash 有值，post 为 null
    created_at: string; // ISO
  };
};

export type MineRowJson = {
  id: string;
  beer_id: string | null;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  kind: "flash" | "post";
  visibility: "private" | "public" | "friends";
  expires_at: string | null;
  created_at: string;
  beers: {
    id: string;
    name: string;
    emoji: string;
    category: string;
    tagline: string;
    icon_url: string | null;
  } | null;
};

export type MinePageJson = {
  checkins: MineRowJson[];
};

// ---- 入参校验 ----

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseCreateCheckinBody(
  raw: unknown,
): { body: CreateCheckinBody } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "body 需为对象" };
  }
  const r = raw as Record<string, unknown>;
  const beerId = r.beer_id;
  if (typeof beerId !== "string" || beerId.trim() === "") {
    return { error: "beer_id 必填且为非空字符串" };
  }
  const lat = r.lat;
  const lng = r.lng;
  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    return { error: "lat 非法：需 -90~90 有限数" };
  }
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
    return { error: "lng 非法：需 -180~180 有限数" };
  }
  const placeRaw = r.place_name;
  let placeName: string | null | undefined = null;
  if (placeRaw === undefined || placeRaw === null) {
    placeName = null;
  } else if (typeof placeRaw === "string") {
    const t = placeRaw.trim();
    placeName = t === "" ? null : t.slice(0, 200);
  } else {
    return { error: "place_name 需为字符串或 null" };
  }
  const kindRaw = r.kind;
  // 兼容旧客户端缺 kind 时按 flash 回退（A.10 历史包）
  let kind: "flash" | "post" = "flash";
  if (kindRaw === undefined || kindRaw === null) {
    kind = "flash";
  } else if (kindRaw === "flash" || kindRaw === "post") {
    kind = kindRaw;
  } else {
    return { error: "kind 非法：只要 flash|post" };
  }
  return {
    body: {
      beer_id: beerId.trim(),
      lat,
      lng,
      ...(placeName === null ? { place_name: null } : { place_name: placeName }),
      kind,
    },
  };
}

export function parseMineParams(
  search: URLSearchParams,
): { limit: number } | { error: string } {
  const limitRaw = search.get("limit");
  const limit = limitRaw === null ? CHECKINS_MINE_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > CHECKINS_MINE_MAX_LIMIT) {
    return { error: `limit 非法：${limitRaw ?? ""}（要 1-${CHECKINS_MINE_MAX_LIMIT} 整数）` };
  }
  return { limit };
}

// ---- 行映射：DB 行 -> WantRecord 兼容形状（前端直接用） ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function toMineRow(raw: unknown): MineRowJson | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const beerId = typeof raw.beer_id === "string" ? raw.beer_id : raw.beer_id === null ? null : null;
  // supabase 返回的 beer_id 可能为 null（FK SET NULL），保留 null
  if (beerId === undefined) return null;
  const lat = typeof raw.lat === "number" && Number.isFinite(raw.lat) ? raw.lat : raw.lat === null ? null : null;
  const lng = typeof raw.lng === "number" && Number.isFinite(raw.lng) ? raw.lng : raw.lng === null ? null : null;
  const placeName = typeof raw.place_name === "string" ? raw.place_name : raw.place_name === null ? null : null;
  const kind = raw.kind === "flash" || raw.kind === "post" ? raw.kind : raw.kind === null || raw.kind === undefined ? "flash" as const : null;
  const visibility = raw.visibility === "private" || raw.visibility === "public" || raw.visibility === "friends" ? raw.visibility : null;
  const expiresAt = typeof raw.expires_at === "string" ? raw.expires_at : raw.expires_at === null ? null : null;
  const createdAt = typeof raw.created_at === "string" ? raw.created_at : null;
  if (id === null || createdAt === null || lat === undefined || lng === undefined || placeName === undefined) return null;
  if (beerId === undefined || kind === null || visibility === null || expiresAt === undefined) return null;
  if (kind !== "flash" && kind !== "post") return null;
  // beers join 可能 null
  let beers: MineRowJson["beers"] = null;
  if (raw.beers !== null && raw.beers !== undefined) {
    if (!isRecord(raw.beers)) return null;
    const b = raw.beers as Record<string, unknown>;
    const bid = typeof b.id === "string" ? b.id : null;
    const name = typeof b.name === "string" ? b.name : null;
    const emoji = typeof b.emoji === "string" ? b.emoji : null;
    const category = typeof b.category === "string" ? b.category : null;
    const tagline = typeof b.tagline === "string" ? b.tagline : null;
    const iconUrl = b.icon_url === null ? null : typeof b.icon_url === "string" ? b.icon_url : null;
    if (bid === null || name === null || emoji === null || category === null || tagline === null || iconUrl === undefined) return null;
    beers = { id: bid, name, emoji, category, tagline, icon_url: iconUrl };
  }
  if (!Number.isFinite(Date.parse(createdAt))) return null;
  if (expiresAt !== null && !Number.isFinite(Date.parse(expiresAt))) return null;
  return {
    id,
    beer_id: beerId as string | null,
    lat: lat as number | null,
    lng: lng as number | null,
    place_name: placeName,
    kind,
    visibility,
    expires_at: expiresAt,
    created_at: createdAt,
    beers,
  };
}

/** DB 行 -> 前端 WantRecord（beer 合成 + placeName 回填 + at/position 冻结 + kind/visibility）。 */
export function mineRowToWantRecord(row: MineRowJson): WantRecord | null {
  if (row.lat === null || row.lng === null) return null;
  const at = Date.parse(row.created_at);
  if (!Number.isFinite(at)) return null;
  const beers = row.beers;
  // beer 信息优先用 join，回退用 beer_id 兜底（避免坏 join 丢整行）
  let beer: Beer | null = null;
  if (beers !== null) {
    beer = {
      id: beers.id,
      name: beers.name,
      emoji: beers.emoji,
      category: beers.category,
      tagline: beers.tagline,
      ...(beers.icon_url !== null ? { icon_url: beers.icon_url } : {}),
    };
  } else if (typeof row.beer_id === "string" && row.beer_id.length > 0) {
    // 无 join 时用最小 beer（至少让钉可渲染，图标走 emoji 回退）
    beer = { id: row.beer_id, name: row.beer_id, emoji: "🍺", category: "", tagline: "" };
  } else {
    return null;
  }
  const position: LatLng = { lat: row.lat, lng: row.lng };
  const expiresAt = row.expires_at !== null ? Date.parse(row.expires_at) : null;
  const out: WantRecord = {
    beer,
    at,
    position,
    kind: row.kind,
    visibility: row.visibility,
    expiresAt: expiresAt !== null && Number.isFinite(expiresAt) ? expiresAt : null,
    id: row.id,
  };
  if (typeof row.place_name === "string" && row.place_name.length > 0) {
    out.placeName = row.place_name;
  }
  return out;
}
