/**
 * UR G.10a 酒桌遊戲房間＋審批（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `GameSocialModels.swift`（入房申請）；
 * 網路形狀對 H.1（建房／active／room?since／ready／start／leave）與 H.2(a)（join 202／審批／狀態）。
 */

export type GamePlayer = {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  seat: number;
  ready: boolean;
  status: string;
  online: boolean;
};

export type GameRoom = {
  id: string;
  code: string;
  game: string;
  host_id: string;
  status: string;
  max_players: number;
  version: number;
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseGameRoom(raw: unknown): GameRoom | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.code !== "string") return null;
  return {
    id: r.id,
    code: r.code,
    game: str(r.game) ?? "liars",
    host_id: str(r.host_id) ?? "",
    status: str(r.status) ?? "lobby",
    max_players: num(r.max_players) ?? 6,
    version: num(r.version) ?? 0,
  };
}

export function parseGamePlayer(raw: unknown): GamePlayer | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.user_id !== "string" || r.user_id === "") return null;
  const nick = str(r.nickname);
  return {
    user_id: r.user_id,
    nickname: nick !== null && nick.trim() !== "" ? nick.trim() : "酒友",
    avatar_url: str(r.avatar_url),
    seat: num(r.seat) ?? 0,
    ready: r.ready === true,
    status: str(r.status) ?? "active",
    online: r.online === true,
  };
}

export type JoinOutcome = { kind: "joined"; roomId: string } | { kind: "pending"; requestId: string };

/** 輸碼加入回包分流（200 直入／202 等批；iOS GameJoinOutcome 口徑）。 */
export function parseJoinOutcome(status: number, body: unknown): JoinOutcome | null {
  if (typeof body !== "object" || body === null) return null;
  const r = body as Record<string, unknown>;
  if (status === 200 && typeof r.room_id === "string") return { kind: "joined", roomId: r.room_id };
  if (status === 202 && typeof r.request_id === "string") return { kind: "pending", requestId: r.request_id };
  return null;
}

export type JoinStatus = { status: string; roomId: string | null };

export function parseJoinStatus(raw: unknown): JoinStatus | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== "string") return null;
  return { status: r.status, roomId: typeof r.room_id === "string" ? r.room_id : null };
}

/** 申請結果人話（null＝還在等；iOS gameJoinStatusText 口徑）。 */
export function joinStatusKey(status: string): string | null {
  switch (status) {
    case "rejected":
      return "gameJoinRejected";
    case "expired":
      return "gameJoinExpired";
    case "cancelled":
      return "gameJoinCancelled";
    default:
      return null;
  }
}

export type JoinRequest = {
  request_id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string | null;
};

export function parseJoinRequest(raw: unknown): JoinRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.request_id !== "string" || r.request_id === "") return null;
  const u = typeof r.user === "object" && r.user !== null ? (r.user as Record<string, unknown>) : null;
  const nick = u !== null && typeof u.nickname === "string" && u.nickname.trim() !== "" ? u.nickname.trim() : "酒友";
  return {
    request_id: r.request_id,
    nickname: nick,
    avatar_url: u !== null && typeof u.avatar_url === "string" ? u.avatar_url : null,
    created_at: typeof r.created_at === "string" ? r.created_at : null,
  };
}

/** 房碼歸一（去空白轉大寫；空即 null）。 */
export function normalizeRoomCode(s: string): string | null {
  const t = s.trim().toUpperCase();
  return t !== "" ? t : null;
}

export type GameSocialError = { key: string; params?: Record<string, string | number> } | null;

/** 社交錯誤人話（null 即透服務端 message；iOS gameSocialErrorText 口徑）。 */
export function gameSocialErrorKey(code: string | null): string | null {
  switch (code) {
    case "too_many_requests":
      return "gameErrTooMany";
    case "chat_rate_limited":
      return "gameErrRate";
    case "muted_in_room":
      return "gameErrMuted";
    case "game_banned":
      return "gameErrBanned";
    case "request_expired":
      return "gameJoinExpired";
    case "wrong_phase":
      return "gameErrEnded";
    default:
      return null;
  }
}
