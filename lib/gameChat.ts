/**
 * UR G.10c 房內聊天＋舉報（v2-only；純函數層，可單測）。
 * 口徑對標 iOS `GameSocialModels.swift`（消息合并／文字校驗／快捷語／舉報類／錯誤）；
 * 網路形狀對 H.2(b) messages（`{items, next}`）與 report。
 * 快捷語文案走 `gq_<key>` i18n（24 條，服務端只認 key）。
 * 常量本地鏡像（不直引 `@/lib/games/rooms`——服務端模塊進客戶端包；單測斷言兩邊相等防漂）。
 */

/** 與服務端 GAME_QUICK_KEYS 逐項同（漂移即單測紅）。 */
export const GAME_QUICK_KEYS = [
  "ready", "hurry", "again", "drink", "cheers_all", "nice", "oops",
  "good_luck", "well_played", "rematch", "brb", "waiting", "go_go",
  "haha", "wow", "cheer_up", "my_turn", "your_turn", "toast_host",
  "thanks", "sorry", "gj", "lol", "cheers_back",
] as const;

/** 與服務端 GAME_MSG_MAX 同值。 */
export const GAME_MSG_MAX = 60;

export type GameChatUser = { id: string; nickname: string; avatar_url: string | null };

export type GameChatMessage = {
  id: string;
  created_at: string | null;
  removed: boolean;
  user: GameChatUser | null;
  kind: string | null;
  quick_key: string | null;
  body: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function nick(v: unknown): string {
  if (typeof v !== "string" || v.trim() === "") return "酒友";
  return v.trim();
}

/** 壞行回 null（iOS LossyChatMessage 口徑）。 */
export function parseGameChatMessage(raw: unknown): GameChatMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return null;
  const u = typeof r.user === "object" && r.user !== null ? (r.user as Record<string, unknown>) : null;
  const qk = str(r.quick_key);
  return {
    id: r.id,
    created_at: str(r.created_at),
    removed: r.removed === true,
    user:
      u !== null && typeof u.id === "string" && u.id !== ""
        ? {
            id: u.id,
            nickname: nick(u.nickname),
            avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
          }
        : null,
    kind: str(r.kind),
    quick_key: qk !== null && (GAME_QUICK_KEYS as readonly string[]).includes(qk) ? qk : null,
    body: str(r.body),
  };
}

/** 新舊合并：id 去重（新覆舊，撤回更新舊行），時間升序，留尾 200（iOS gameChatMerge 口徑）。 */
export function mergeGameChat(old: GameChatMessage[], incoming: GameChatMessage[], limit = 200): GameChatMessage[] {
  const byId = new Map<string, GameChatMessage>();
  for (const m of old) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const sorted = [...byId.values()].sort((a, b) => {
    const ta = a.created_at !== null ? Date.parse(a.created_at) : NaN;
    const tb = b.created_at !== null ? Date.parse(b.created_at) : NaN;
    const va = Number.isFinite(ta) ? (ta as number) : -1;
    const vb = Number.isFinite(tb) ? (tb as number) : -1;
    if (va !== vb) return va - vb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.slice(-limit);
}

/** 文字發送前校驗（trim 1…60，UTF-16；iOS gameChatTextValid 口徑）。 */
export function gameChatTextValid(s: string): boolean {
  const t = s.trim();
  return t !== "" && t.length <= GAME_MSG_MAX;
}

export const GAME_REPORT_CATS = ["harassment", "cheating", "inappropriate", "other", "safety"] as const;

export type GameReportCat = (typeof GAME_REPORT_CATS)[number];

export function parseGameReportCat(raw: unknown): GameReportCat | null {
  return typeof raw === "string" && (GAME_REPORT_CATS as readonly string[]).includes(raw)
    ? (raw as GameReportCat)
    : null;
}
