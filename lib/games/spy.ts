import { SPY_PACKS, SPY_WORDS, type SpyPack, type SpyWordPair } from "./spyWords";

/**
 * UR H.3 誰是臥底（真聯機）— 純函數狀態機，不碰 DB／網絡／時鐘（時間一律由調用方傳 nowMs）。
 * 狀態整份存在 `spy_states.state`（0067，RLS 全拒，只 service_role 讀寫）。
 *
 * 流程：deal（看詞）→ speak（每人 60 秒，可提前結束）→ discuss（自由討論）→ vote → result → 下一輪 speak …→ over。
 * 倒數到點由「懶結算」推進（advanceSpy，GET／動作前調用）：新截止時間從舊截止時間起算，
 * 久沒人輪詢也不會讓每個人多得時間；提前結束（speak_done）則從當下起算新的 60 秒。
 *
 * 秘密：每人的詞與身份只在 server。viewSpyFor 按人裁剪——只回自己的詞；身份只在「已出局／結束」後公開；
 * 兩種詞只在結束時公開。events 與房間廣播絕不帶秘密。
 */

export const SPY_MIN_PLAYERS = 4;
export const SPY_MAX_PLAYERS = 8;
/** 兩位臥底要 7 人起，否則臥底一出場就追平 */
export const SPY_TWO_SPIES_MIN = 7;

export const SPY_SECONDS = { deal: 12, speak: 60, discuss: 45, vote: 30, result: 8 } as const;

export type SpyRole = "civilian" | "spy";
export type SpyPhase = "deal" | "speak" | "discuss" | "vote" | "result" | "over";
export type SpyWinner = "civilians" | "spies";

export type SpyRules = { spy_count: 1 | 2; packs: SpyPack[] };

export function parseSpyRules(raw: unknown): SpyRules {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const packs = Array.isArray(r.packs)
    ? [...new Set(r.packs.filter((p): p is SpyPack => (SPY_PACKS as readonly unknown[]).includes(p)))]
    : [];
  return { spy_count: r.spy_count === 2 ? 2 : 1, packs: packs.length > 0 ? packs : [...SPY_PACKS] };
}

/** 實際臥底數：2 位要 7 人起，否則退回 1 */
export function effectiveSpyCount(rules: SpyRules, playerCount: number): 1 | 2 {
  return rules.spy_count === 2 && playerCount >= SPY_TWO_SPIES_MIN ? 2 : 1;
}

export type SpyPlayerState = { id: string; seat: number; role: SpyRole; word: string; alive: boolean };

export type SpyVoteResult = {
  counts: Record<string, number>;
  leaders: string[];
  /** 單一最高票才有人出局；平票／無人投 → null */
  eliminated: string | null;
  votes: Record<string, string>;
};

export type SpyState = {
  v: 1;
  round: number;
  phase: SpyPhase;
  /** 當前階段截止時間（epoch ms）；over 為 null */
  deadline_ms: number | null;
  players: SpyPlayerState[];
  civilian_word: string;
  spy_word: string;
  order: string[];
  speak_index: number;
  votes: Record<string, string>;
  last_result: SpyVoteResult | null;
  winner: SpyWinner | null;
  /** 第一位發言者的輪轉游標（每輪 +1，讓開口的人輪流） */
  start_cursor: number;
};

export type Rng = () => number;

function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 開局：分詞、分身份（人數須 4–8；否則回 error，不拋）。 */
export function createSpyState(
  members: ReadonlyArray<{ id: string; seat: number }>,
  rules: SpyRules,
  nowMs: number,
  rng: Rng = Math.random,
  bank: readonly SpyWordPair[] = SPY_WORDS,
): SpyState | { error: string } {
  const n = members.length;
  if (n < SPY_MIN_PLAYERS || n > SPY_MAX_PLAYERS) {
    return { error: `人數需 ${SPY_MIN_PLAYERS}–${SPY_MAX_PLAYERS} 人` };
  }
  const pool = bank.filter((p) => rules.packs.includes(p.pack));
  const usable = pool.length > 0 ? pool : bank;
  if (usable.length === 0) return { error: "詞庫為空" };
  const pair = usable[Math.floor(rng() * usable.length)];
  const civiliansUseA = rng() < 0.5;
  const civilianWord = civiliansUseA ? pair.a : pair.b;
  const spyWord = civiliansUseA ? pair.b : pair.a;
  const sorted = [...members].sort((a, b) => a.seat - b.seat);
  const spyIds = new Set(shuffled(sorted.map((m) => m.id), rng).slice(0, effectiveSpyCount(rules, n)));
  return {
    v: 1,
    round: 1,
    phase: "deal",
    deadline_ms: nowMs + SPY_SECONDS.deal * 1000,
    players: sorted.map((m) => ({
      id: m.id,
      seat: m.seat,
      role: spyIds.has(m.id) ? "spy" : "civilian",
      word: spyIds.has(m.id) ? spyWord : civilianWord,
      alive: true,
    })),
    civilian_word: civilianWord,
    spy_word: spyWord,
    order: [],
    speak_index: 0,
    votes: {},
    last_result: null,
    winner: null,
    start_cursor: Math.floor(rng() * n),
  };
}

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

export function aliveIds(s: SpyState): string[] {
  return s.players.filter((p) => p.alive).map((p) => p.id);
}

function spiesAlive(s: SpyState): number {
  return s.players.filter((p) => p.alive && p.role === "spy").length;
}

function civiliansAlive(s: SpyState): number {
  return s.players.filter((p) => p.alive && p.role === "civilian").length;
}

export function currentSpeaker(s: SpyState): string | null {
  return s.phase === "speak" ? (s.order[s.speak_index] ?? null) : null;
}

function winnerOf(s: SpyState): SpyWinner | null {
  if (spiesAlive(s) === 0) return "civilians";
  if (spiesAlive(s) >= civiliansAlive(s)) return "spies";
  return null;
}

// ---------------------------------------------------------------------------
// 轉移（全部回新 state，不改入參）
// ---------------------------------------------------------------------------

function clone(s: SpyState): SpyState {
  return JSON.parse(JSON.stringify(s)) as SpyState;
}

/** 進入某一輪的發言：存活者按座位排，從輪轉游標起（每輪換人開口）。 */
function enterSpeak(s: SpyState, startMs: number): SpyState {
  const alive = s.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat).map((p) => p.id);
  const k = alive.length === 0 ? 0 : (s.start_cursor + s.round - 1) % alive.length;
  s.order = [...alive.slice(k), ...alive.slice(0, k)];
  s.speak_index = 0;
  s.votes = {};
  s.phase = "speak";
  s.deadline_ms = startMs + SPY_SECONDS.speak * 1000;
  return s;
}

/** 輪到下一位（跳過已出局／離場者）；說完所有人→討論。 */
function nextSpeaker(s: SpyState, startMs: number): SpyState {
  let i = s.speak_index + 1;
  while (i < s.order.length && !s.players.find((p) => p.id === s.order[i])?.alive) i += 1;
  if (i >= s.order.length) {
    s.speak_index = s.order.length;
    s.phase = "discuss";
    s.deadline_ms = startMs + SPY_SECONDS.discuss * 1000;
  } else {
    s.speak_index = i;
    s.deadline_ms = startMs + SPY_SECONDS.speak * 1000;
  }
  return s;
}

/** 開票：單一最高票出局；平票或沒人投→沒人出局。有人出局後立即判勝負。 */
function resolveVotes(s: SpyState, atMs: number): SpyState {
  const counts: Record<string, number> = {};
  for (const [voter, target] of Object.entries(s.votes)) {
    const v = s.players.find((p) => p.id === voter);
    const t = s.players.find((p) => p.id === target);
    if (v?.alive === true && t?.alive === true) counts[target] = (counts[target] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(counts));
  const leaders = top === 0 ? [] : Object.keys(counts).filter((id) => counts[id] === top).sort();
  const eliminated = leaders.length === 1 ? leaders[0] : null;
  s.last_result = { counts, leaders, eliminated, votes: { ...s.votes } };
  if (eliminated !== null) {
    const p = s.players.find((x) => x.id === eliminated);
    if (p !== undefined) p.alive = false;
  }
  const w = eliminated !== null ? winnerOf(s) : null;
  if (w !== null) {
    s.winner = w;
    s.phase = "over";
    s.deadline_ms = null;
  } else {
    s.phase = "result";
    s.deadline_ms = atMs + SPY_SECONDS.result * 1000;
  }
  return s;
}

/**
 * 懶結算：把所有已到點的階段依序推進（從舊截止時間起算，久沒人輪詢也不會多給時間）。
 * 回 `{state, changed}`；沒到點回原 state。
 */
export function advanceSpy(state: SpyState, nowMs: number): { state: SpyState; changed: boolean } {
  let s = state;
  let changed = false;
  for (let guard = 0; guard < 500; guard += 1) {
    if (s.deadline_ms === null || s.deadline_ms > nowMs || s.phase === "over") break;
    const at: number = s.deadline_ms;
    if (!changed) {
      s = clone(s);
      changed = true;
    }
    switch (s.phase) {
      case "deal":
        s = enterSpeak(s, at);
        break;
      case "speak":
        s = nextSpeaker(s, at);
        break;
      case "discuss":
        s.phase = "vote";
        s.votes = {};
        s.deadline_ms = at + SPY_SECONDS.vote * 1000;
        break;
      case "vote":
        s = resolveVotes(s, at);
        break;
      case "result":
        s.round += 1;
        s = enterSpeak(s, at);
        break;
      default:
        return { state: s, changed };
    }
  }
  return { state: s, changed };
}

export type SpyActionResult = { ok: true; state: SpyState } | { ok: false; reason: "wrong_phase" | "not_your_turn" | "not_alive" | "invalid_target" | "already_voted" };

/** 發言者按「說完了」：提前結束，下一位從當下起算新的 60 秒。 */
export function speakDone(state: SpyState, userId: string, nowMs: number): SpyActionResult {
  if (state.phase !== "speak") return { ok: false, reason: "wrong_phase" };
  if (state.order[state.speak_index] !== userId) return { ok: false, reason: "not_your_turn" };
  return { ok: true, state: nextSpeaker(clone(state), nowMs) };
}

/** 投票：只能投存活的他人；每人一票；全員投完立即開票。 */
export function castVote(state: SpyState, voter: string, target: string, nowMs: number): SpyActionResult {
  if (state.phase !== "vote") return { ok: false, reason: "wrong_phase" };
  if (state.players.find((p) => p.id === voter)?.alive !== true) return { ok: false, reason: "not_alive" };
  if (target === voter || state.players.find((p) => p.id === target)?.alive !== true) {
    return { ok: false, reason: "invalid_target" };
  }
  if (state.votes[voter] !== undefined) return { ok: false, reason: "already_voted" };
  const s = clone(state);
  s.votes[voter] = target;
  const allIn = aliveIds(s).every((id) => s.votes[id] !== undefined);
  return { ok: true, state: allIn ? resolveVotes(s, nowMs) : s };
}

/**
 * 玩家離場（leave／kick）：視為出局，不拖慢局面。
 * 輪到他發言→換下一位；投票階段清掉他的票並檢查是否已全員投完；之後判勝負。
 */
export function leaveSpy(state: SpyState, userId: string, nowMs: number): { state: SpyState; changed: boolean } {
  const me = state.players.find((p) => p.id === userId);
  if (me === undefined || !me.alive || state.phase === "over") return { state, changed: false };
  let s = clone(state);
  const wasSpeaking = currentSpeaker(s) === userId;
  s.players.find((p) => p.id === userId)!.alive = false;
  delete s.votes[userId];
  for (const [voter, target] of Object.entries(s.votes)) {
    if (target === userId) delete s.votes[voter];
  }
  const w = winnerOf(s);
  if (w !== null) {
    s.winner = w;
    s.phase = "over";
    s.deadline_ms = null;
    return { state: s, changed: true };
  }
  if (wasSpeaking) s = nextSpeaker(s, nowMs);
  if (s.phase === "vote" && aliveIds(s).every((id) => s.votes[id] !== undefined)) s = resolveVotes(s, nowMs);
  return { state: s, changed: true };
}

// ---------------------------------------------------------------------------
// 發言權限與防洩詞（messages 路由用）
// ---------------------------------------------------------------------------

/** 這個人此刻能不能發文字（快捷語另算，存活者永遠可發）。 */
export function canSendText(state: SpyState, userId: string): { ok: true } | { ok: false; reason: string } {
  const me = state.players.find((p) => p.id === userId);
  if (state.phase === "over") return { ok: true };
  if (me === undefined || !me.alive) return { ok: false, reason: "已出局，只能發快捷語" };
  switch (state.phase) {
    case "speak":
      return currentSpeaker(state) === userId ? { ok: true } : { ok: false, reason: "未輪到你發言" };
    case "discuss":
    case "result":
      return { ok: true };
    default:
      return { ok: false, reason: "此階段只能發快捷語" };
  }
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 文字是否直接講出該玩家自己的詞（發言前攔截；只攔自己那個詞）。 */
export function leaksOwnWord(state: SpyState, userId: string, text: string): boolean {
  const me = state.players.find((p) => p.id === userId);
  if (me === undefined) return false;
  const w = normalize(me.word);
  return w.length > 0 && normalize(text).includes(w);
}

// ---------------------------------------------------------------------------
// 按人裁剪的視圖（GET 用）。絕不含別人的詞；身份只在出局／結束後公開。
// ---------------------------------------------------------------------------

export type SpyViewJson = {
  round: number;
  phase: SpyPhase;
  /** ISO；over 為 null */
  deadline: string | null;
  /** 伺服器此刻（ISO）：客戶端用它校準倒數，不靠本地時鐘 */
  server_now: string;
  /** 每階段秒數（客戶端畫倒數環的總長用） */
  seconds: { deal: number; speak: number; discuss: number; vote: number; result: number };
  me: { word: string | null; alive: boolean; role: SpyRole | null; my_vote: string | null } | null;
  players: Array<{ id: string; seat: number; alive: boolean; role: SpyRole | null }>;
  order: string[];
  speak_index: number;
  current_speaker: string | null;
  votes_in: number;
  last_result:
    | { counts: Record<string, number>; leaders: string[]; eliminated: string | null; votes: Record<string, string> }
    | null;
  winner: SpyWinner | null;
  /** 僅 over：兩個詞對外公開 */
  words: { civilian: string; spy: string } | null;
};

export function viewSpyFor(state: SpyState, userId: string, nowMs: number): SpyViewJson {
  const over = state.phase === "over";
  const me = state.players.find((p) => p.id === userId) ?? null;
  const showRole = (p: SpyPlayerState): SpyRole | null => (over || !p.alive ? p.role : null);
  return {
    round: state.round,
    phase: state.phase,
    deadline: state.deadline_ms === null ? null : new Date(state.deadline_ms).toISOString(),
    server_now: new Date(nowMs).toISOString(),
    seconds: { ...SPY_SECONDS },
    me:
      me === null
        ? null
        : { word: me.word, alive: me.alive, role: showRole(me), my_vote: state.votes[userId] ?? null },
    players: state.players.map((p) => ({ id: p.id, seat: p.seat, alive: p.alive, role: showRole(p) })),
    order: [...state.order],
    speak_index: state.speak_index,
    current_speaker: currentSpeaker(state),
    votes_in: Object.keys(state.votes).length,
    last_result:
      state.phase === "result" || over
        ? state.last_result === null
          ? null
          : { ...state.last_result }
        : null,
    winner: state.winner,
    words: over ? { civilian: state.civilian_word, spy: state.spy_word } : null,
  };
}

/** 從 jsonb 讀回 state（形狀不對回 null，調用方按局壞處理）。 */
export function parseSpyState(raw: unknown): SpyState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.players) || typeof r.phase !== "string") return null;
  return raw as SpyState;
}
