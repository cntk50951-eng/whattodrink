/**
 * UR D.2 會話 API 的純函數層（可單測）：1v1 去重鍵＋入參窄校驗＋
 * 不透明 cursor＋行映射。DB 行不可信：逐行校驗，壞行丟棄（沿 wall 口徑）。
 * 陌生人／隱身／水位語義由 route 層執行，本層只管形狀。
 */

export const CHAT_DEFAULT_LIMIT = 20;
export const CHAT_MAX_LIMIT = 50;
/** D.3 首期文本上限＋發送限流（沿乾杯額度配方，防刷；匿名走不到此層，全 🔒）。 */
export const CHAT_TEXT_MAX = 2000;
export const CHAT_MINUTE_LIMIT = 30;
export const CHAT_DAY_LIMIT = 200;

/** 1v1 去重鍵：雙方 id 排序拼（同兩人永遠同一鍵；自聊由 route 擋 400）。 */
export function directKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 128 ? t : null;
}

function asFiniteMs(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

/** `POST /conversations {user_id}`：只收對方 id，其餘 server 派生。 */
export function parseCreateConversationBody(
  raw: unknown,
): { user_id: string } | { error: string } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const user_id = asNonEmptyString(raw.user_id);
  if (user_id === null) return { error: "user_id 必填（1–128 字）" };
  return { user_id };
}

/* ---- 不透明 cursor（base64url JSON；壞了＝400，不猜，沿 wall 口徑） ---- */

export type ChatCursor = { v: 1; ca: string; id: string };

export function encodeChatCursor(cursor: ChatCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeChatCursor(raw: string): ChatCursor | null {
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
  if (typeof parsed.ca !== "string" || typeof parsed.id !== "string") return null;
  if (!Number.isFinite(Date.parse(parsed.ca))) return null;
  return { v: 1, ca: parsed.ca, id: parsed.id };
}

export type ChatListParams = {
  limit: number;
  cursor: ChatCursor | null;
};

/** `GET /conversations?limit&cursor`：limit 缺省 20，上限 50。 */
export function parseChatListParams(
  search: URLSearchParams,
): { params: ChatListParams } | { error: string } {
  const limitRaw = search.get("limit");
  const limit = limitRaw === null ? CHAT_DEFAULT_LIMIT : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > CHAT_MAX_LIMIT) {
    return { error: `limit 非法：${limitRaw ?? ""}（要 1-${CHAT_MAX_LIMIT} 整數）` };
  }
  const cursorRaw = search.get("cursor");
  if (cursorRaw === null) return { params: { limit, cursor: null } };
  const cursor = decodeChatCursor(cursorRaw);
  if (cursor === null) return { error: "cursor 非法" };
  return { params: { limit, cursor } };
}

/** `PATCH /:id/read {last_read_at}`：水位必須顯式給（server 不猜時鐘）。 */
export function parseReadBody(raw: unknown): { last_read_at: number } | { error: string } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const last_read_at = asFiniteMs(raw.last_read_at);
  if (last_read_at === null) return { error: "last_read_at 必填（毫秒 epoch）" };
  return { last_read_at };
}

/** 路由 id 段：非空即收（存在性由 route 以 404 收斂，不在本層判）。 */
export function parseConversationId(raw: string): { id: string } | { error: string } {
  const id = raw.trim();
  if (id.length === 0 || id.length > 128) return { error: "id 非法" };
  return { id };
}

/**
 * `POST /:id/messages`：首期只收 text（image／audio 待 D.6，kind 先驗死）；
 * `client_msg_id` 必填（冪等唯一，弱網重發不 double）。
 */
export function parseCreateMessageBody(
  raw: unknown,
): { kind: "text"; body: string; client_msg_id: string } | { error: string } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  if (raw.kind !== "text") return { error: "kind 非法（首期只收 text）" };
  const body = asNonEmptyString(raw.body);
  if (body === null || body.length > CHAT_TEXT_MAX) {
    return { error: `body 必填（1–${CHAT_TEXT_MAX} 字）` };
  }
  const client_msg_id = asNonEmptyString(raw.client_msg_id);
  if (client_msg_id === null) return { error: "client_msg_id 必填（冪等鍵）" };
  return { kind: "text", body, client_msg_id };
}

/* ---- 行映射 ---- */

export type ChatPeerJson = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
};

export type ChatMessageJson = {
  id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  /** Epoch ms（DB 是 ISO，mapper 轉；轉不過＝壞行）。 */
  created_at: number;
  mine: boolean;
};

export type ConversationJson = {
  id: string;
  peer: ChatPeerJson | null;
  last_message: ChatMessageJson | null;
  unread: number;
  muted: boolean;
  /** 末動 Epoch ms（末條時間，無條則建會時間；列表排序鍵）。 */
  updated_at: number;
};

/** 消息行映射：壞行回 null（呼叫方跳過）；`mine` 由呼叫方傳 me 派生。 */
export function toChatMessage(raw: unknown, me: string): ChatMessageJson | null {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.id);
  const sender_id = asNonEmptyString(raw.sender_id);
  if (id === null || sender_id === null) return null;
  if (typeof raw.kind !== "string" || raw.kind.length === 0) return null;
  const body = raw.body === null ? null : asNonEmptyString(raw.body);
  // body 空串視為缺（text 必填由 CHECK 保；此處只做形狀，空串不炸整頁）
  if (body === undefined) return null;
  const createdRaw = typeof raw.created_at === "string" ? raw.created_at : null;
  if (createdRaw === null) return null;
  const created_at = Date.parse(createdRaw);
  if (!Number.isFinite(created_at)) return null;
  return { id, sender_id, kind: raw.kind, body: body ?? null, created_at, mine: sender_id === me };
}

/** 對方簡檔映射：只吐公開三列（精確坐標／email 永不回，沿架構隱私線）。 */
export function toChatPeer(raw: unknown): ChatPeerJson | null {
  if (!isRecord(raw)) return null;
  const user_id = asNonEmptyString(raw.id);
  const nickname = asNonEmptyString(raw.nickname);
  if (user_id === null || nickname === null) return null;
  const avatar = raw.avatar_url;
  if (avatar !== null && typeof avatar !== "string") return null;
  return { user_id, nickname, avatar_url: avatar };
}

/** 過期判定：`expires_at <= now` 即懶刪（讀時跳過，沿 invites 口徑）。 */
export function isConversationExpired(expiresAtIso: string, nowMs: number): boolean {
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return true;
  return t <= nowMs;
}
