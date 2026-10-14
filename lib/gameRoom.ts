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

export type GameBid = { qty: number; face: number; zhai: boolean };

export type GameRound = {
  no: number;
  status: string;
  starter_id: string | null;
  current_turn_user: string | null;
  turn_deadline: string | null;
  last_bid: GameBid | null;
  my_dice: number[];
  revealed: {
    dice: Record<string, number[]>;
    challenger_id: string | null;
    bidder_id: string | null;
    counted: number | null;
    bid_met: boolean | null;
    loser_id: string | null;
  } | null;
};

function parseBid(raw: unknown): GameBid | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.qty !== "number" || typeof r.face !== "number") return null;
  return { qty: Math.floor(r.qty), face: Math.floor(r.face), zhai: r.zhai === true };
}

/** 房規子集（叫骰面板用；非法回落默认，沿 parseRules 口徑）。 */
export function parseRoomRules(raw: unknown): { mode: "standard" | "deal_only"; minOpenQty: number; zhaiEnabled: boolean } {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const minQ = typeof r.min_open_qty === "number" && Number.isFinite(r.min_open_qty) ? Math.floor(r.min_open_qty) : 2;
  return {
    mode: r.mode === "deal_only" ? "deal_only" : "standard",
    minOpenQty: Math.min(20, Math.max(1, minQ)),
    zhaiEnabled: r.zhai_enabled === true,
  };
}

export type ClientBid = { qty: number; face: number; zhai: boolean };

/**
 * 叫骰合法性客戶端鏡像（只判按鈕可點，最終以服務端 `isValidBid` 為準；
 * 不直引 `@/lib/games/liars`——其頂層 `node:crypto` 會炸客戶端打包。
 * 文案與服務端逐字同，單測 fuzz 對齊）。
 */
export function clientBidCheck(
  prev: ClientBid | null,
  next: { qty: number; face: number },
  rules: { minOpenQty: number; zhaiEnabled: boolean },
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(next.qty) || next.qty < 1 || next.qty > 200) return { ok: false, reason: "qty 非法" };
  if (!Number.isInteger(next.face) || next.face < 1 || next.face > 6) return { ok: false, reason: "face 只要 1-6" };
  if (prev === null) {
    if (next.qty < rules.minOpenQty) return { ok: false, reason: `开局数量至少 ${rules.minOpenQty}` };
    return { ok: true };
  }
  if (next.qty < prev.qty) return { ok: false, reason: "数量不可减少" };
  if (next.qty === prev.qty && next.face <= prev.face) return { ok: false, reason: "同数量点数必须更大" };
  return { ok: true };
}
/** 回合解析（壞形回 null；iOS 輪詢口徑，壞 round 不炸房）。 */
export function parseGameRound(raw: unknown): GameRound | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.no !== "number") return null;
  const dice = Array.isArray(r.my_dice)
    ? (r.my_dice as unknown[]).filter((x): x is number => typeof x === "number")
    : [];
  const rv = typeof r.revealed === "object" && r.revealed !== null ? (r.revealed as Record<string, unknown>) : null;
  return {
    no: Math.floor(r.no as number),
    status: str(r.status) ?? "bidding",
    starter_id: str(r.starter_id),
    current_turn_user: str(r.current_turn_user),
    turn_deadline: str(r.turn_deadline),
    last_bid: parseBid(r.last_bid),
    my_dice: dice,
    revealed:
      rv !== null
        ? {
            dice:
              typeof rv.dice === "object" && rv.dice !== null
                ? Object.fromEntries(
                    Object.entries(rv.dice as Record<string, unknown>)
                      .filter(([, v]) => Array.isArray(v))
                      .map(([k, v]) => [k, (v as unknown[]).filter((x): x is number => typeof x === "number")]),
                  )
                : {},
            challenger_id: str(rv.challenger_id),
            bidder_id: str(rv.bidder_id),
            counted: num(rv.counted),
            bid_met: typeof rv.bid_met === "boolean" ? rv.bid_met : null,
            loser_id: str(rv.loser_id),
          }
        : null,
  };
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
