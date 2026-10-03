/**
 * UR E.7 打卡帖子留言 — 入参校验＋行映射＋限流判定（纯函数，可单测）。
 * 展示口径：登录显示昵称，匿名显示 `匿名·短號`（anon_id 哈希前 4 码）。
 * 限流口径：匿名每帖 outstanding 1 条（作者回后清零）；登录 10min 3 条；
 * 同 IP 同帖 24h 匿名 5 条。计数由路由查库，本文件只做纯判定。
 */

export const COMMENT_BODY_MAX = 500;
export const COMMENTS_DEFAULT_LIMIT = 20;
export const COMMENTS_MAX_LIMIT = 50;
export const COMMENT_LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const COMMENT_LOGIN_MAX_PER_WINDOW = 3;
export const COMMENT_IP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COMMENT_IP_MAX_PER_WINDOW = 5;

export type CommentJson = {
  id: string;
  checkin_id: string;
  body: string;
  status: "visible" | "hidden";
  created_at: string; // ISO
  author:
    | { kind: "user"; user_id: string; name: string | null }
    | { kind: "anon"; tag: string };
  /** 是否帖作者（路由按 viewer＋帖归属算；默认 false）。 */
  is_author: boolean;
  /** 是否我发的（登录按 user_id，匿名按 anon cookie；默认 false）。 */
  is_mine: boolean;
};

export type CommentsPageJson = {
  comments: CommentJson[];
  nextCursor: string | null;
};

// ---- body 校验 ----

export function parseCommentBody(
  raw: unknown,
): { body: string } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "body 需为对象" };
  }
  const r = raw as Record<string, unknown>;
  const b = r.body;
  if (typeof b !== "string") return { error: "body 需为字符串" };
  const t = b.trim();
  if (t === "") return { error: "body 不可为空" };
  if (t.length > COMMENT_BODY_MAX) {
    return { error: `body 非法：≤${COMMENT_BODY_MAX} 字` };
  }
  return { body: t };
}

// ---- 不透明 cursor（base64url JSON；壞了＝400，不猜，沿 wall 口径） ----

export type CommentsCursor = { v: 1; ca: string; id: string };

export function encodeCommentsCursor(cursor: CommentsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCommentsCursor(raw: string): CommentsCursor | null {
  try {
    const o = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as unknown;
    if (typeof o !== "object" || o === null) return null;
    const r = o as Record<string, unknown>;
    if (r.v !== 1 || typeof r.ca !== "string" || typeof r.id !== "string") {
      return null;
    }
    if (!Number.isFinite(Date.parse(r.ca)) || r.id === "") return null;
    return { v: 1, ca: r.ca, id: r.id };
  } catch {
    return null;
  }
}

export function parseCommentsParams(
  search: URLSearchParams,
): { limit: number; cursor: CommentsCursor | null } | { error: string } {
  const limitRaw = search.get("limit");
  const limit = limitRaw === null ? COMMENTS_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > COMMENTS_MAX_LIMIT) {
    return { error: `limit 非法：${limitRaw ?? ""}（要 1-${COMMENTS_MAX_LIMIT} 整数）` };
  }
  const cursorRaw = search.get("cursor");
  if (cursorRaw !== null) {
    const cursor = decodeCommentsCursor(cursorRaw);
    if (cursor === null) return { error: "cursor 非法" };
    return { limit, cursor };
  }
  return { limit, cursor: null };
}

// ---- 匿名短號（确定性 4 位大写 hex；不同 anon_id 极小概率碰撞可接受，展示用） ----

export function anonShortTag(anonId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < anonId.length; i++) {
    h ^= anonId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
}

// ---- 行映射（DB 行不可信：坏行回 null 整行跳过，沿 wall/checkins 口径） ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** 映射前取原始 anon_id（身份章比对用；不下发前端）。 */
export function rawAnonIdOf(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  return typeof raw.anon_id === "string" && raw.anon_id !== "" ? raw.anon_id : null;
}

export function toCommentJson(raw: unknown): CommentJson | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : null;
  const checkinId =
    typeof raw.checkin_id === "string" && raw.checkin_id !== "" ? raw.checkin_id : null;
  const body = typeof raw.body === "string" ? raw.body : null;
  const status = raw.status === "visible" || raw.status === "hidden" ? raw.status : null;
  const createdAt =
    typeof raw.created_at === "string" && Number.isFinite(Date.parse(raw.created_at))
      ? raw.created_at
      : null;
  if (id === null || checkinId === null || body === null || status === null || createdAt === null) {
    return null;
  }
  const userId = typeof raw.user_id === "string" && raw.user_id !== "" ? raw.user_id : null;
  const anonId = typeof raw.anon_id === "string" && raw.anon_id !== "" ? raw.anon_id : null;
  if (userId === null && anonId === null) return null;
  // users(nickname) join 可 null（匿名行／缺行回退首字兜底由 UI 做）。
  const usersRaw = isRecord(raw.users) ? (raw.users as Record<string, unknown>) : null;
  const nickname =
    usersRaw !== null && typeof usersRaw.nickname === "string" && usersRaw.nickname !== ""
      ? usersRaw.nickname
      : null;
  return {
    id,
    checkin_id: checkinId,
    body,
    status,
    created_at: createdAt,
    author:
      userId !== null
        ? { kind: "user", user_id: userId, name: nickname }
        : { kind: "anon", tag: anonShortTag(anonId as string) },
    // 身份章由路由按 viewer 补（withViewerFlags）；直映射默认双 false。
    is_author: false,
    is_mine: false,
  };
}

/**
 * 身份章（DEF-20261003-001）：帖作者/all 人可见作者 badge；本人看自己的带「我」。
 * viewer 身份由路由给（登录 userId／匿名 anonId／游客 null）；user_id／anon_id
 * 永不下发前端（A.17／A.19 隱私口徑保留），只下发两布尔。
 * rawAnonId＝映射前原始 anon_id（匿名行比对用；登录行传 null）。
 */
export function withViewerFlags(
  comment: CommentJson,
  viewer: { userId: string } | { anonId: string } | null,
  postAuthorId: string | null,
  rawAnonId: string | null,
): CommentJson {
  const isAuthor =
    comment.author.kind === "user" &&
    postAuthorId !== null &&
    comment.author.user_id === postAuthorId;
  let isMine = false;
  if (viewer !== null) {
    if ("userId" in viewer) {
      isMine = comment.author.kind === "user" && comment.author.user_id === viewer.userId;
    } else {
      isMine =
        comment.author.kind === "anon" &&
        rawAnonId !== null &&
        rawAnonId === viewer.anonId;
    }
  }
  return { ...comment, is_author: isAuthor, is_mine: isMine };
}

// ---- 限流纯判定（计数由路由查库传入时间戳数组） ----

/**
 * 匿名 outstanding：该身份在作者最后一次回复之后还有可见留言即 true（不可再评）。
 * authorReplyMs 为作者在该帖的回复时间数组（ Versus 该匿名身份？简化：作者任何回复
 * 即视为推进对话——单层结构无线程归属，按帖级判定，见 UR）。
 */
export function anonHasOutstanding(
  anonVisibleMs: readonly number[],
  authorReplyMs: readonly number[],
): boolean {
  if (anonVisibleMs.length === 0) return false;
  const lastReply = authorReplyMs.length > 0 ? Math.max(...authorReplyMs) : -1;
  return anonVisibleMs.some((t) => t > lastReply);
}

/** 窗口内计数是否超限（含边界：窗口起点毫秒数由调用方按 now-window 算）。 */
export function overWindowLimit(countInWindow: number, max: number): boolean {
  return countInWindow >= max;
}

/**
 * UR E.10 回复归属（纯函数）：正文 `@名 ` 前缀即对该名的一层回复。
 * 名取 @ 后首个空白前连续串；无前缀／空名回 null（顶层行）。
 * 匹配由调用方按展示名找最近上文（作者分得清人即可的短号口径，不做 id 绑定）。
 */
export function parseReplyTarget(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const m = body.match(/^@(\S+)\s/);
  if (m === null) return null;
  const name = m[1].trim();
  return name === "" ? null : name;
}
