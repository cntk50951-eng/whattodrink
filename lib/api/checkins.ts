/**
 * UR A.10 打卡持久化 — `POST /api/v1/checkins` 入参校验 + `GET /api/v1/checkins/mine` 行映射（纯函数，可单测）。
 * `want` 打卡落库为 `type='want' + visibility='private'`，二次登录靠 `mine` 回显。
 * DB 行是不可信输入：逐行校验，坏行跳过（与 wall 同容错口径，见 lib/api/wall.ts）。
 */

import type { Beer } from "../beers";
import type { LatLng } from "../geo";
import type { WantRecord } from "../wantRecord";
import { parseTags } from "./taste";

export const CHECKINS_MINE_LIMIT = 30;
export const CHECKINS_MINE_MAX_LIMIT = 50;

export type CreateCheckinBody = {
  /** UR E.3：酒可选——null 即纯照片打卡（DB 列本就 nullable，pins 早已 null-safe）。 */
  beer_id: string | null;
  lat: number;
  lng: number;
  place_name?: string | null;
  kind: "flash" | "post";
  /** UR E.2 三件套（dataURL 直存口徑；後端再驗上限＋審核，見 POST 路由）。 */
  photo_url?: string | null;
  /** UR E.20 他人釘縮影（96px JPEG data: URL；pins 只回此列，原圖永不進列表）。 */
  photo_thumb?: string | null;
  note?: string | null;
  audio_url?: string | null;
  audio_seconds?: number | null;
  transcript?: string | null;
  /** UR E.28 打卡标签（taxonomy key，≤5；缺席即无）。 */
  tags?: string[];
};

/** E.2 上限（body 肥大即 400；抓幀 ≤1024 jpeg 約 200–400k，60s 語音約 1M 內）。 */
/** UR E.20 縮圖上限（96px jpeg 約 3–6k；32k 封頂防濫用，沿 photo 口徑）。 */
export const CHECKIN_PHOTO_MAX_CHARS = 1_000_000;
export const CHECKIN_PHOTO_THUMB_MAX_CHARS = 32_000;
export const CHECKIN_AUDIO_MAX_CHARS = 2_000_000;
export const CHECKIN_NOTE_MAX = 500;
export const CHECKIN_TRANSCRIPT_MAX = 2000;

export type CreateCheckinJson = {
  checkin: {
    id: string;
    beer_id: string | null;
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
  /** UR E.2 三件套（mine 回顯帶回，前端 WantRecord 直用；缺列回 null）。 */
  photo_url: string | null;
  note: string | null;
  audio_url: string | null;
  audio_seconds: number | null;
  transcript: string | null;
  /** UR E.28 打卡标签（taxonomy key 数组；无即 []，旧行缺列回 []）。 */
  tags: string[];
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
  // UR E.3：酒可选——缺／null／空串一律按 null 收（旧客户端照常送 id，行为不变）。
  let beer_id: string | null = null;
  if (beerId !== undefined && beerId !== null) {
    if (typeof beerId !== "string") {
      return { error: "beer_id 需为字符串或 null" };
    }
    const t = beerId.trim();
    beer_id = t === "" ? null : t;
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
  // UR E.2 三件套（白名單＋上限；壞值即 400，不靜默丟——發送工作流要即時拒絕）。
  const photoRaw = r.photo_url;
  let photoUrl: string | null = null;
  if (photoRaw !== undefined && photoRaw !== null) {
    if (
      typeof photoRaw !== "string" ||
      !photoRaw.startsWith("data:image/") ||
      photoRaw.length > CHECKIN_PHOTO_MAX_CHARS
    ) {
      return { error: "photo_url 非法：要 data:image 且 ≤1M 字符" };
    }
    photoUrl = photoRaw;
  }
  // UR E.20 縮圖（白名單＋上限；壞值即 400，不靜默丟——沿 photo 口徑）。
  const thumbRaw = r.photo_thumb;
  let photoThumb: string | null = null;
  if (thumbRaw !== undefined && thumbRaw !== null) {
    if (
      typeof thumbRaw !== "string" ||
      !thumbRaw.startsWith("data:image/") ||
      thumbRaw.length > CHECKIN_PHOTO_THUMB_MAX_CHARS
    ) {
      return { error: "photo_thumb 非法：要 data:image 且 ≤32K 字符" };
    }
    photoThumb = thumbRaw;
  }
  const noteRaw = r.note;
  let note: string | null = null;
  if (noteRaw !== undefined && noteRaw !== null) {
    if (typeof noteRaw !== "string") return { error: "note 需为字符串或 null" };
    const t = noteRaw.trim();
    if (t !== "") {
      if (t.length > CHECKIN_NOTE_MAX) {
        return { error: "note 非法：≤500 字" };
      }
      note = t;
    }
  }
  const audioRaw = r.audio_url;
  let audioUrl: string | null = null;
  if (audioRaw !== undefined && audioRaw !== null) {
    if (
      typeof audioRaw !== "string" ||
      !audioRaw.startsWith("data:audio/") ||
      audioRaw.length > CHECKIN_AUDIO_MAX_CHARS
    ) {
      return { error: "audio_url 非法：要 data:audio 且 ≤2M 字符" };
    }
    audioUrl = audioRaw;
  }
  const secsRaw = r.audio_seconds;
  let audioSeconds: number | null = null;
  if (secsRaw !== undefined && secsRaw !== null) {
    if (
      typeof secsRaw !== "number" ||
      !Number.isFinite(secsRaw) ||
      secsRaw < 0 ||
      secsRaw > 60
    ) {
      return { error: "audio_seconds 非法：要 0–60" };
    }
    audioSeconds = secsRaw;
  }
  if (audioUrl === null) audioSeconds = null;
  const transcriptRaw = r.transcript;
  let transcript: string | null = null;
  if (transcriptRaw !== undefined && transcriptRaw !== null) {
    if (typeof transcriptRaw !== "string") {
      return { error: "transcript 需为字符串或 null" };
    }
    const t = transcriptRaw.trim();
    if (t !== "") {
      if (t.length > CHECKIN_TRANSCRIPT_MAX) {
        return { error: "transcript 非法：≤2000 字" };
      }
      transcript = t;
    }
  }
  // UR E.28 打卡标签（≤5／已知／去重；缺席即无，兼容旧版）。
  // （parseTags 在 taste.ts；checkins.ts 引 taste，taste 零本地 import，无循环。）
  const tagParsed = parseTags(r.tags);
  if (tagParsed !== null && "error" in tagParsed) return tagParsed;
  return {
    body: {
      beer_id,
      lat,
      lng,
      ...(placeName === null ? { place_name: null } : { place_name: placeName }),
      kind,
      ...(photoUrl !== null ? { photo_url: photoUrl } : {}),
      ...(photoThumb !== null ? { photo_thumb: photoThumb } : {}),
      ...(note !== null ? { note } : {}),
      ...(audioUrl !== null ? { audio_url: audioUrl } : {}),
      ...(audioSeconds !== null ? { audio_seconds: audioSeconds } : {}),
      ...(transcript !== null ? { transcript } : {}),
      ...(tagParsed !== null ? { tags: tagParsed.tags } : {}),
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

// ---- 详情 id 校验（DEF-20260929-003：DELETE/GET 共用，纯函数可单测） ----

/** UUID 宽松校验（防路径注入拼进查询；非空＋字符集即过，存在性由 DB 判）。 */
export function parseCheckinIdParam(
  raw: unknown,
): { id: string } | { error: string } {
  if (typeof raw !== "string" || raw === "") {
    return { error: "id 非法：需为非空字符串" };
  }
  if (raw.length > 64 || !/^[A-Za-z0-9-]+$/.test(raw)) {
    return { error: "id 非法：字符集越界" };
  }
  return { id: raw };
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
  // UR E.2 三件套（列缺席回 null，不炸整行；沿既有容错口徑）。
  const photoUrl =
    typeof raw.photo_url === "string"
      ? raw.photo_url
      : raw.photo_url === null || raw.photo_url === undefined
        ? null
        : null;
  const note =
    typeof raw.note === "string"
      ? raw.note
      : raw.note === null || raw.note === undefined
        ? null
        : null;
  const audioUrl =
    typeof raw.audio_url === "string"
      ? raw.audio_url
      : raw.audio_url === null || raw.audio_url === undefined
        ? null
        : null;
  const audioSeconds =
    typeof raw.audio_seconds === "number" && Number.isFinite(raw.audio_seconds)
      ? raw.audio_seconds
      : raw.audio_seconds === null || raw.audio_seconds === undefined
        ? null
        : null;
  const transcript =
    typeof raw.transcript === "string"
      ? raw.transcript
      : raw.transcript === null || raw.transcript === undefined
        ? null
        : null;
  // UR E.28 打卡标签（数组即收窄去重；缺席／非数组回 []，旧行兼容）。
  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (
    photoUrl === undefined ||
    note === undefined ||
    audioUrl === undefined ||
    audioSeconds === undefined ||
    transcript === undefined
  ) {
    return null;
  }
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
    photo_url: photoUrl,
    note,
    audio_url: audioUrl,
    audio_seconds: audioSeconds,
    transcript,
    tags,
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
  }
  // UR E.3：双双缺即无酒打卡（beer null，钉／卡走照片＋note 主视觉，不丢行）。
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
  // UR E.2：回顯三件套進 WantRecord（本地 E.1 字段同形，mine 回來即有圖文音）。
  if (typeof row.photo_url === "string" && row.photo_url.startsWith("data:image/")) {
    out.photoDataUrl = row.photo_url;
  }
  if (typeof row.note === "string" && row.note !== "") {
    out.note = row.note;
  }
  if (
    typeof row.audio_url === "string" &&
    row.audio_url !== "" &&
    typeof row.audio_seconds === "number" &&
    Number.isFinite(row.audio_seconds)
  ) {
    out.audio = { url: row.audio_url, seconds: row.audio_seconds };
  }
  return out;
}

/**
 * UR E.2 詳情可見門（純函數可單測）：本人全見；public 全見；
 * friends 僅互好友見；其餘（含陌生＋private 他人）不見。
 */
export function canViewCheckin(
  viewerId: string,
  ownerId: string | null,
  visibility: unknown,
  friendIds: readonly string[],
): boolean {
  if (ownerId !== null && viewerId === ownerId) return true;
  if (visibility === "public") return true;
  if (
    visibility === "friends" &&
    ownerId !== null &&
    friendIds.includes(ownerId)
  ) {
    return true;
  }
  return false;
}
