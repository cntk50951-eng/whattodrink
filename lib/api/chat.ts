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
/**
 * UR D.6 附件上限（bucket 寬限內再收一檔，沿架構 §6 分層口徑；
 * ext 白名單防可執行＋MIME 混淆）。
 */
export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const CHAT_VOICE_MAX_SECS = 60;
export const CHAT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export const CHAT_VOICE_EXTS = ["webm", "mp4", "m4a", "ogg"] as const;

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
): { user_id: string; origin: ConversationOrigin } | { error: string } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const user_id = asNonEmptyString(raw.user_id);
  if (user_id === null) return { error: "user_id 必填（1–128 字）" };
  return { user_id, origin: parseConversationOrigin((raw as Record<string, unknown>).origin) };
}

/** UR D.10 会话来源（建会话依据；好友建即 friend；非法回落 direct，不 400）。 */
export type ConversationOrigin = "friend" | "cheers" | "party" | "profile" | "direct";

export function parseConversationOrigin(raw: unknown): ConversationOrigin {
  if (
    raw === "friend" ||
    raw === "cheers" ||
    raw === "party" ||
    raw === "profile" ||
    raw === "direct"
  ) {
    return raw;
  }
  return "direct";
}

/** UR D.10 陌生人配额（对方最新消息后我的连续数；3 达线拒，沿交接 §3.2）。 */
export const STRANGER_MSG_LIMIT = 3;

export type ChatLiteMsg = { sender_id: string; created_at: string };

/**
 * 配额计算（消息按 created_at 升序传入；返回我方连续数 used＋剩 remaining）。
 * 对方任意一条即清零（其后只数我的）；空列 used 0。
 */
export function strangerQuota(
  ordered: ChatLiteMsg[],
  myId: string,
): { used: number; remaining: number } {
  let used = 0;
  for (const m of ordered) {
    if (m.sender_id === myId) {
      used += 1;
    } else {
      used = 0;
    }
  }
  return { used, remaining: Math.max(0, STRANGER_MSG_LIMIT - used) };
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
 * `POST /:id/messages`：text 必 body；image caption 可选（body ≤2000，无即 null 存）；
 * audio 不带正文（带即 400）；text 可带分享附件 `attachments:[{checkin_id}]`（UR E.13）。
 * 文件附件兼容交接 discriminated 形：客户端可带 `kind:"file"`＋`bucket`，有即校验一致
 * （无即沿 D.6 旧兼容，由 kind 定桶）；share 形只许 text。
 * （D.6 開閘；`client_msg_id` 必填（冪等唯一，弱網重發不 double）。
 */
export type ChatAttachment = {
  path: string;
  mime: string;
  bytes: number;
  secs?: number;
};

/** 超限错误码（413；调用方据此置状态，普通校验仍 400）。 */
export type ChatParseError = { error: string; status?: 413 };

/** 站内打卡分享附件（非文件，无 path／bucket；可见性由路由验）。 */
export type CheckinShareAttachment = {
  checkin_id: string;
  /** 地点展示（店名／区名，绝不放坐标；卡片地点行用）。 */
  place?: string;
};

export function parseCreateMessageBody(
  raw: unknown,
):
  | { kind: "text"; body: string; share?: CheckinShareAttachment; client_msg_id: string }
  | { kind: "image"; body: string | null; attachments: ChatAttachment[]; client_msg_id: string }
  | { kind: "audio"; attachments: ChatAttachment[]; client_msg_id: string }
  | ChatParseError {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const client_msg_id = asNonEmptyString(raw.client_msg_id);
  if (client_msg_id === null) return { error: "client_msg_id 必填（冪等鍵）" };
  if (raw.kind === "text") {
    const body = asNonEmptyString(raw.body);
    if (body === null || body.length > CHAT_TEXT_MAX) {
      return { error: `body 必填（1–${CHAT_TEXT_MAX} 字）` };
    }
    if (raw.attachments === undefined) return { kind: "text", body, client_msg_id };
    // UR E.13：text 仅允许分享附件一枚（checkin_id uuid 形；存在＋可见由路由判）。
    if (!Array.isArray(raw.attachments) || raw.attachments.length !== 1) {
      return { error: "分享附件只要 1 個" };
    }
    const first = raw.attachments[0] as Record<string, unknown> | null;
    const checkinId = typeof first === "object" && first !== null ? first.checkin_id : null;
    if (typeof checkinId !== "string" || checkinId === "" || checkinId.length > 64 || !/^[A-Za-z0-9-]+$/.test(checkinId)) {
      return { error: "checkin_id 非法" };
    }
    // place 可选（展示用纯文本，非坐标；超长截断，非法即丢不挡发送）。
    const placeRaw = typeof first === "object" && first !== null ? first.place : null;
    const place =
      typeof placeRaw === "string" && placeRaw.trim() !== ""
        ? placeRaw.trim().slice(0, 120)
        : undefined;
    return {
      kind: "text",
      body,
      share: place === undefined ? { checkin_id: checkinId } : { checkin_id: checkinId, place },
      client_msg_id,
    };
  }
  if (raw.kind === "image" || raw.kind === "audio") {
    const atts = parseAttachments(raw.attachments, raw.kind);
    if ("error" in atts) return atts;
    if (raw.kind === "image") {
      // D.8 caption 可选存 body（缺席／null／空串即无；超长 400）。
      let cap: string | null = null;
      if (raw.body !== undefined && raw.body !== null) {
        if (typeof raw.body !== "string") return { error: "caption 非法" };
        const t = raw.body.trim();
        if (t.length > CHAT_TEXT_MAX) return { error: `caption 只要 ≤${CHAT_TEXT_MAX} 字` };
        cap = t === "" ? null : t;
      }
      return { kind: raw.kind, body: cap, attachments: atts.attachments, client_msg_id };
    }
    // D.8 audio 不带正文（带即 400；读端 body 恒 null）。
    if (raw.body !== undefined && raw.body !== null) {
      return { error: "audio 不带正文" };
    }
    return { kind: raw.kind, attachments: atts.attachments, client_msg_id };
  }
  return { error: "kind 非法（只要 text|image|audio）" };
}

function parseAttachments(
  raw: unknown,
  kind: "image" | "audio",
): { attachments: ChatAttachment[] } | ChatParseError {
  if (!Array.isArray(raw) || raw.length !== 1) {
    return { error: "attachments 只要 1 個（首期單附件）" };
  }
  const r = raw[0] as Record<string, unknown>;
  if (typeof r !== "object" || r === null) return { error: "attachment 需为对象" };
  // D.8 交接 discriminated 形兼容：kind:"file"＋bucket 可带，有即校验（无即沿旧）。
  if (r.kind !== undefined && r.kind !== "file") {
    return { error: "文件附件 kind 只要 file" };
  }
  const bucket = kind === "image" ? "chat-images" : "chat-voice";
  if (r.bucket !== undefined && r.bucket !== bucket) {
    return { error: "bucket 与 kind 不一致" };
  }
  const path = asNonEmptyString(r.path);
  // 路徑約定 `<uid>/<uuid>.<ext>`（首段歸屬 route 層驗，這裡只驗形狀防遍歷）
  if (path === null || path.includes("..") || path.split("/").length !== 2) {
    return { error: "path 非法" };
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const bytes = typeof r.bytes === "number" && Number.isFinite(r.bytes) ? r.bytes : -1;
  if (kind === "image") {
    if (!(CHAT_IMAGE_EXTS as readonly string[]).includes(ext)) {
      return { error: `圖片只要 ${CHAT_IMAGE_EXTS.join("/")}` };
    }
    if (bytes < 0 || bytes > CHAT_IMAGE_MAX_BYTES) {
      return { error: "圖片超 10MB", status: 413 };
    }
    if (typeof r.mime !== "string" || !r.mime.startsWith("image/")) {
      return { error: "mime 非圖片" };
    }
    return { attachments: [{ path, mime: r.mime, bytes }] };
  }
  if (!(CHAT_VOICE_EXTS as readonly string[]).includes(ext)) {
    return { error: `語音只要 ${CHAT_VOICE_EXTS.join("/")}` };
  }
  if (bytes < 0 || bytes > CHAT_VOICE_MAX_BYTES) {
    return { error: "語音超 2MB", status: 413 };
  }
  const secs = typeof r.secs === "number" && Number.isFinite(r.secs) ? r.secs : -1;
  if (secs <= 0 || secs > CHAT_VOICE_MAX_SECS) return { error: "語音超 60s" };
  return { attachments: [{ path, mime: "audio", bytes, secs }] };
}

/** `POST /uploads/sign {purpose, ext, bytes}`（D.6 直傳簽名）。 */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_EXTS = ["jpg", "jpeg", "png", "webp"] as const;

export function parseSignBody(
  raw: unknown,
): { purpose: "image" | "voice" | "avatar"; ext: string; bytes: number; sha256: string | null } | { error: string; status?: 413 } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const purpose = raw.purpose;
  if (purpose !== "image" && purpose !== "voice" && purpose !== "avatar") {
    return { error: "purpose 只要 image|voice|avatar" };
  }
  const ext = typeof raw.ext === "string" ? raw.ext.toLowerCase() : "";
  const allow = purpose === "image" ? CHAT_IMAGE_EXTS : purpose === "voice" ? CHAT_VOICE_EXTS : AVATAR_EXTS;
  if (!(allow as readonly string[]).includes(ext)) {
    return { error: `ext 非法（${allow.join("/")}）` };
  }
  const bytes = typeof raw.bytes === "number" && Number.isFinite(raw.bytes) ? raw.bytes : -1;
  const cap = purpose === "image" ? CHAT_IMAGE_MAX_BYTES : purpose === "voice" ? CHAT_VOICE_MAX_BYTES : AVATAR_MAX_BYTES;
  if (bytes <= 0 || bytes > cap) return { error: "bytes 非法", status: 413 as const };
  // D.8 sha256 可选（hex64；有即确定性 path，同值重签同址，零新表）。
  let sha256: string | null = null;
  if (raw.sha256 !== undefined && raw.sha256 !== null) {
    if (typeof raw.sha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(raw.sha256)) {
      return { error: "sha256 非法（hex64）" };
    }
    sha256 = raw.sha256.toLowerCase();
  }
  return { purpose, ext, bytes, sha256 };
}

/** 申报大小 vs storage 真实大小（±10% 容差；超差即谎报，调用方 400＋删档）。 */
export function isSizeWithin(actual: number, declared: number, tol = 0.1): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(declared) || declared <= 0 || actual < 0) {
    return false;
  }
  return Math.abs(actual - declared) <= declared * tol;
}

/** `POST /uploads/view {bucket, path}`（D.6 播時簽名；歸屬 route 層驗）。 */
export function parseViewBody(raw: unknown): { bucket: string; path: string } | { error: string } {
  if (!isRecord(raw)) return { error: "body 需为对象" };
  const bucket = raw.bucket;
  if (bucket !== "chat-images" && bucket !== "chat-voice") {
    return { error: "bucket 只要 chat-images|chat-voice" };
  }
  const path = asNonEmptyString(raw.path);
  if (path === null || path.includes("..") || path.split("/").length !== 2) {
    return { error: "path 非法" };
  }
  return { bucket, path };
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
  /** D.6 附件直傳（server 寫入時已驗歸屬＋大小；讀端只渲染不信任執行）。 */
  attachments: unknown[];
  /** D.8 顶层回显（取 attachments[0] 文件型；文本／分享即 null，省客户端下钻）。 */
  mime: string | null;
  bytes: number | null;
  secs: number | null;
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
  /** UR D.10 行三字段（好友分区＋建会话依据＋陌生人配额，好友行 quota null）。 */
  is_friend: boolean;
  origin: string;
  quota: { limit: number; used: number; remaining: number } | null;
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
  const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  // D.8 顶层回显：首个文件型附件的 mime/bytes/secs（文本／分享即 null）。
  let mime: string | null = null;
  let bytes: number | null = null;
  let secs: number | null = null;
  const first = attachments.length > 0 ? attachments[0] : null;
  if (typeof first === "object" && first !== null && typeof (first as Record<string, unknown>).path === "string") {
    const f = first as Record<string, unknown>;
    mime = typeof f.mime === "string" ? f.mime : null;
    bytes = typeof f.bytes === "number" && Number.isFinite(f.bytes) ? f.bytes : null;
    secs = typeof f.secs === "number" && Number.isFinite(f.secs) ? f.secs : null;
  }
  return { id, sender_id, kind: raw.kind, body: body ?? null, attachments, mime, bytes, secs, created_at, mine: sender_id === me };
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
