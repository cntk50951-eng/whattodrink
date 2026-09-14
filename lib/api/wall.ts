/**
 * UR A.6 公開牆 API 的查表＋轉 JSON（純函數，可單測）。
 * 欄位與 `lib/posts.ts` WallPost 對齊（過堂結論見 backlog UR A.6）：
 * 匿名只吐 public 行＋公開列；`likedByMe／me／reported` 固定 false；
 * 作者只剩公開三列（`avatar_url` 誠實回 URL，不冒充 mock 的 emoji）。
 * DB 行是不可信輸入：逐行校驗，壞行跳過（用户內容不斷整牆——
 * 與 beers 種子表「壞行整批 500」不同，牆行是用户寫的，見註）。
 */

export type WallSort = "hot" | "latest";

export const WALL_DEFAULT_LIMIT = 20;
export const WALL_MAX_LIMIT = 50;
/** hot 只看 24h 窗（沿前端 `sortHot` 的 HOT_WINDOW_MS）。 */
export const WALL_HOT_WINDOW_MS = 24 * 3600_000;
/** hot 窗內行數上限（V1 牆量小，快照排序；超了取最新的 N 行）。 */
export const WALL_HOT_WINDOW_CAP = 500;

export type WallAuthorJson = {
  nickname: string;
  avatar_url: string | null;
  gender: "male" | "female" | "secret";
} | null;

export type WallPostJson = {
  id: string;
  photo: string | null;
  note: string;
  transcript: string;
  audioSeconds: number | null;
  audioUrl: string | null;
  likes: number;
  likedByMe: false;
  /** Epoch ms（DB 是 ISO，mapper 轉；轉不過＝壞行）。 */
  createdAt: number;
  author: WallAuthorJson;
};

export type WallPageJson = {
  posts: WallPostJson[];
  nextCursor: string | null;
};

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

function asNullableInt(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return undefined;
}

/**
 * 讚數歸一：postgrest 嵌套計數形狀（`[{count}]`）或純數字都吃；
 * 其它一律判壞（呼叫方跳過該行）。
 */
export function normalizeLikes(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw >= 0 ? raw : null;
  }
  if (Array.isArray(raw)) {
    let total = 0;
    for (const item of raw) {
      if (!isRecord(item) || typeof item.count !== "number") return null;
      if (!Number.isInteger(item.count) || item.count < 0) return null;
      total += item.count;
    }
    return total;
  }
  if (isRecord(raw) && typeof raw.count === "number") {
    return Number.isInteger(raw.count) && raw.count >= 0 ? raw.count : null;
  }
  return null;
}

function toWallAuthor(raw: unknown): WallAuthorJson | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const nickname = asString(raw.nickname);
  const avatarUrl = asNullableString(raw.avatar_url);
  const gender = raw.gender;
  if (
    nickname === null ||
    avatarUrl === undefined ||
    (gender !== "male" && gender !== "female" && gender !== "secret")
  ) {
    return undefined;
  }
  return { nickname, avatar_url: avatarUrl, gender };
}

/** 單行映射：壞行回 null（呼叫方跳過＋計數 warn，不炸整牆）。 */
export function toWallPost(raw: unknown): WallPostJson | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const photo = asNullableString(raw.photo_url);
  const note = asString(raw.note);
  const transcript = asString(raw.transcript);
  const audioUrl = asNullableString(raw.audio_url);
  const audioSeconds = asNullableInt(raw.audio_seconds);
  const createdRaw = asString(raw.created_at);
  const likes = normalizeLikes(raw.post_likes);
  const author =
    "users" in raw ? toWallAuthor(raw.users) : toWallAuthor(raw.author);
  if (
    id === null ||
    photo === undefined ||
    note === null ||
    transcript === null ||
    audioUrl === undefined ||
    audioSeconds === undefined ||
    createdRaw === null ||
    likes === null ||
    author === undefined
  ) {
    return null;
  }
  const createdAt = Date.parse(createdRaw);
  if (!Number.isFinite(createdAt)) return null;
  return {
    id,
    photo,
    note,
    transcript,
    audioSeconds,
    audioUrl,
    likes,
    likedByMe: false,
    createdAt,
    author,
  };
}

/**
 * hot 排序口徑＝前端 `sortHot`（讚倒序→時間倒序）＋id 墊底
 * （前端無 id 墊底；API 加它只為翻頁全序，exact-tie 外順序一致）。
 */
export function compareHot(a: WallPostJson, b: WallPostJson): number {
  return (
    b.likes - a.likes || b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1)
  );
}

export function sortHotPosts(posts: WallPostJson[]): WallPostJson[] {
  return [...posts].sort(compareHot);
}

/* ---- 不透明 cursor（base64url JSON；壞了＝400，不猜） ---- */

export type LatestCursor = { v: 1; sort: "latest"; ca: string; id: string };
export type HotCursor = {
  v: 1;
  sort: "hot";
  likes: number;
  ca: string;
  id: string;
};
export type WallCursor = LatestCursor | HotCursor;

export function encodeCursor(cursor: WallCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): WallCursor | null {
  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1) return null;
  if (parsed.sort === "latest") {
    if (typeof parsed.ca !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    if (!Number.isFinite(Date.parse(parsed.ca))) return null;
    return { v: 1, sort: "latest", ca: parsed.ca, id: parsed.id };
  }
  if (parsed.sort === "hot") {
    if (
      typeof parsed.likes !== "number" ||
      !Number.isInteger(parsed.likes) ||
      parsed.likes < 0 ||
      typeof parsed.ca !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }
    if (!Number.isFinite(Date.parse(parsed.ca))) return null;
    return { v: 1, sort: "hot", likes: parsed.likes, ca: parsed.ca, id: parsed.id };
  }
  return null;
}

/** latest 下一頁起點（供 route 組 keyset 查詢）。 */
export function latestCursorOf(post: WallPostJson): LatestCursor {
  return {
    v: 1,
    sort: "latest",
    ca: new Date(post.createdAt).toISOString(),
    id: post.id,
  };
}

/** hot 下一頁起點。 */
export function hotCursorOf(post: WallPostJson): HotCursor {
  return {
    v: 1,
    sort: "hot",
    likes: post.likes,
    ca: new Date(post.createdAt).toISOString(),
    id: post.id,
  };
}

/**
 * hot 窗內翻頁：已排好序的數組，丟掉排在 cursor 之前（含等於）的行。
 * ISO 時間字串同格式可直接比（lexicographic＝時序）。
 */
export function dropAboveHotCursor(
  sorted: WallPostJson[],
  cursor: HotCursor,
): WallPostJson[] {
  const cursorMs = Date.parse(cursor.ca);
  return sorted.filter((p) => {
    if (p.likes !== cursor.likes) return p.likes < cursor.likes;
    if (p.createdAt !== cursorMs) return p.createdAt < cursorMs;
    return p.id < cursor.id;
  });
}

/* ---- 入參窄校驗（zod helper 落地前手寫先行，見 A.2-4 註記） ---- */

export type WallParams = {
  sort: WallSort;
  limit: number;
  cursor: WallCursor | null;
};

export function parseWallParams(
  search: URLSearchParams,
): { params: WallParams } | { error: string } {
  const sortRaw = search.get("sort");
  const sort: WallSort = sortRaw === null ? "latest" : sortRaw as WallSort;
  if (sort !== "hot" && sort !== "latest") {
    return { error: `sort 非法：${sortRaw ?? ""}（只要 hot|latest）` };
  }
  const limitRaw = search.get("limit");
  const limit = limitRaw === null ? WALL_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > WALL_MAX_LIMIT) {
    return { error: `limit 非法：${limitRaw ?? ""}（要 1-${WALL_MAX_LIMIT} 整數）` };
  }
  const cursorRaw = search.get("cursor");
  if (cursorRaw === null) return { params: { sort, limit, cursor: null } };
  const cursor = decodeCursor(cursorRaw);
  if (cursor === null || cursor.sort !== sort) {
    return { error: "cursor 非法或與 sort 不配" };
  }
  return { params: { sort, limit, cursor } };
}
