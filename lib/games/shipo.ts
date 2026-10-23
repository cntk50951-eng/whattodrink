import { SHIPO_CARDS, shipoCardByCode, type ShipoLang } from "./shipoCards";

/**
 * 老實人·識破（shipo，按瞎掰王原版）— 純函數狀態機，不碰 DB／網絡／時鐘（時間一律由調用方傳 nowMs）。
 * 狀態整份存在 `shipo_states.state`（0069，RLS 全拒，只 service_role 讀寫）。
 *
 * 流程：peek（9 秒，只有老實人看到真相）→ talk（自由追問，走房內聊天；想想可打一次「公三小」）→
 *       pick（想想指認老實人）→ result（翻牌計分）→ 下一輪（想想傳給下一位）… → over。
 * 倒數到點由「懶結算」推進（advanceShipo，GET／動作前調用），新截止從舊截止起算。
 *
 * 秘密：身份與真相只在 server。viewShipoFor 按人裁剪——peek 階段只有老實人拿到 truth；
 * 他人身份、真相在 result 之前絕不出現在任何回包／事件。
 */

export const SHIPO_MIN_PLAYERS = 4;
export const SHIPO_MAX_PLAYERS = 6;
export const SHIPO_START_SCORE = 3;
export const SHIPO_SECONDS = { peek: 9, pick: 60, result: 20 } as const;
export const SHIPO_TALK_DEFAULT = 240;

export type ShipoRole = "judge" | "honest" | "bluffer";
export type ShipoPhase = "peek" | "talk" | "pick" | "result" | "over";

export type ShipoRules = { talk_seconds: number };

export function parseShipoRules(raw: unknown): ShipoRules {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const t = r.talk_seconds;
  const ok = typeof t === "number" && Number.isInteger(t) && t >= 60 && t <= 600;
  return { talk_seconds: ok ? t : SHIPO_TALK_DEFAULT };
}

/** 3–4 人 3 輪，5–6 人 2 輪 */
export function shipoRoundsFor(playerCount: number): number {
  return playerCount <= 4 ? 3 : 2;
}

export type ShipoResult = {
  honest_id: string;
  /** 被想想指認的人；pick 超時未選為 null */
  picked_id: string | null;
  picked_correct: boolean;
  /** 公三小打中誰（身份）；沒打為 null */
  accuse_hit: "bluffer" | "honest" | null;
  /** 本輪每人分數變化 */
  delta: Record<string, number>;
  /** 老實人或想想中途離場，本輪作廢不計分 */
  voided: boolean;
};

export type ShipoState = {
  v: 1;
  round: number;
  rounds_total: number;
  phase: ShipoPhase;
  /** 當前階段截止（epoch ms）；over 為 null */
  deadline_ms: number | null;
  talk_seconds: number;
  /** 座位順序的全部玩家（含已離場，離場者在 left） */
  order: string[];
  judge_id: string;
  roles: Record<string, ShipoRole>;
  scores: Record<string, number>;
  card_code: string;
  used_cards: string[];
  /** 本輪公三小（每輪限 1 次，打出即公開目標） */
  accuse: { target_id: string } | null;
  picked: string | null;
  /** result 階段已按「下一輪」的人 */
  acks: string[];
  left: string[];
  result: ShipoResult | null;
  winners: string[] | null;
};

export type Rng = () => number;

function activeIds(s: ShipoState): string[] {
  return s.order.filter((id) => !s.left.includes(id));
}

function clone(s: ShipoState): ShipoState {
  return JSON.parse(JSON.stringify(s)) as ShipoState;
}

/** 抽身份＋抽新題，進 peek。調用方保證在場 ≥ 2 人。 */
function dealRound(s: ShipoState, nowMs: number, rng: Rng): ShipoState {
  const next = clone(s);
  const act = activeIds(next);
  const others = act.filter((id) => id !== next.judge_id);
  const honest = others[Math.floor(rng() * others.length)];
  next.roles = {};
  for (const id of act) next.roles[id] = id === next.judge_id ? "judge" : id === honest ? "honest" : "bluffer";
  const unused = SHIPO_CARDS.filter((c) => !next.used_cards.includes(c.code));
  const pool = unused.length > 0 ? unused : SHIPO_CARDS;
  const card = pool[Math.floor(rng() * pool.length)];
  next.card_code = card.code;
  next.used_cards = [...next.used_cards, card.code];
  next.accuse = null;
  next.picked = null;
  next.acks = [];
  next.result = null;
  next.phase = "peek";
  next.deadline_ms = nowMs + SHIPO_SECONDS.peek * 1000;
  return next;
}

/** 開局：4–6 人；第 1 輪想想＝房主（不在名單時取最小座位）。 */
export function createShipoState(
  members: ReadonlyArray<{ id: string; seat: number }>,
  hostId: string,
  rules: ShipoRules,
  nowMs: number,
  rng: Rng = Math.random,
): ShipoState | { error: string } {
  const n = members.length;
  if (n < SHIPO_MIN_PLAYERS || n > SHIPO_MAX_PLAYERS) {
    return { error: `人數需 ${SHIPO_MIN_PLAYERS}–${SHIPO_MAX_PLAYERS} 人` };
  }
  if (SHIPO_CARDS.length === 0) return { error: "題庫為空" };
  const sorted = [...members].sort((a, b) => a.seat - b.seat);
  const order = sorted.map((m) => m.id);
  const base: ShipoState = {
    v: 1,
    round: 1,
    rounds_total: shipoRoundsFor(n),
    phase: "peek",
    deadline_ms: null,
    talk_seconds: rules.talk_seconds,
    order,
    judge_id: order.includes(hostId) ? hostId : order[0],
    roles: {},
    scores: Object.fromEntries(order.map((id) => [id, SHIPO_START_SCORE])),
    card_code: "",
    used_cards: [],
    accuse: null,
    picked: null,
    acks: [],
    left: [],
    result: null,
    winners: null,
  };
  return dealRound(base, nowMs, rng);
}

// ---------------------------------------------------------------------------
// 計分
// ---------------------------------------------------------------------------

/** 本輪結算（pick 或 pick 超時）。picked 為 null＝想想沒指認。 */
function resolveRound(s: ShipoState, picked: string | null, nowMs: number): ShipoState {
  const next = clone(s);
  const face = shipoCardByCode(next.card_code)?.difficulty ?? 1;
  const honestId = Object.keys(next.roles).find((id) => next.roles[id] === "honest") ?? "";
  const delta: Record<string, number> = {};
  const add = (id: string, n: number) => {
    delta[id] = (delta[id] ?? 0) + n;
  };
  const pickedCorrect = picked !== null && picked === honestId;
  if (picked !== null) {
    if (pickedCorrect) {
      add(next.judge_id, face);
      add(honestId, face);
    } else {
      add(picked, face);
    }
  }
  let hit: ShipoResult["accuse_hit"] = null;
  if (next.accuse !== null) {
    const role = next.roles[next.accuse.target_id];
    if (role === "bluffer") {
      hit = "bluffer";
      add(next.judge_id, 1);
      add(next.accuse.target_id, -1);
    } else if (role === "honest") {
      hit = "honest";
      add(next.judge_id, -3);
    }
  }
  for (const [id, d] of Object.entries(delta)) next.scores[id] = (next.scores[id] ?? 0) + d;
  next.picked = picked;
  next.result = {
    honest_id: honestId,
    picked_id: picked,
    picked_correct: pickedCorrect,
    accuse_hit: hit,
    delta,
    voided: false,
  };
  next.phase = "result";
  next.deadline_ms = nowMs + SHIPO_SECONDS.result * 1000;
  next.acks = [];
  return next;
}

/** 本輪作廢（老實人或想想離場）：不計分，直接進 result 讓大家看真相。 */
function voidRound(s: ShipoState, nowMs: number): ShipoState {
  const next = clone(s);
  const honestId = Object.keys(next.roles).find((id) => next.roles[id] === "honest") ?? "";
  next.result = { honest_id: honestId, picked_id: null, picked_correct: false, accuse_hit: null, delta: {}, voided: true };
  next.phase = "result";
  next.deadline_ms = nowMs + SHIPO_SECONDS.result * 1000;
  next.acks = [];
  return next;
}

function winnersOf(s: ShipoState): string[] {
  const act = activeIds(s);
  const pool = act.length > 0 ? act : s.order;
  const best = Math.max(...pool.map((id) => s.scores[id] ?? 0));
  return pool.filter((id) => (s.scores[id] ?? 0) === best);
}

function finish(s: ShipoState): ShipoState {
  const next = clone(s);
  next.phase = "over";
  next.deadline_ms = null;
  next.winners = winnersOf(next);
  return next;
}

/** 想想傳給左手邊（座位順序下一位在場者）。 */
function nextJudge(s: ShipoState): string {
  const n = s.order.length;
  const from = s.order.indexOf(s.judge_id);
  for (let i = 1; i <= n; i += 1) {
    const id = s.order[(from + i) % n];
    if (!s.left.includes(id)) return id;
  }
  return s.judge_id;
}

function nextRound(s: ShipoState, nowMs: number, rng: Rng): ShipoState {
  if (s.round >= s.rounds_total || activeIds(s).length < SHIPO_MIN_PLAYERS - 1) return finish(s);
  const next = clone(s);
  next.round += 1;
  next.judge_id = nextJudge(next);
  return dealRound(next, nowMs, rng);
}

// ---------------------------------------------------------------------------
// 懶結算
// ---------------------------------------------------------------------------

export function advanceShipo(
  state: ShipoState,
  nowMs: number,
  rng: Rng = Math.random,
): { state: ShipoState; changed: boolean } {
  let s = state;
  let changed = false;
  for (let i = 0; i < 12; i += 1) {
    if (s.deadline_ms === null || nowMs < s.deadline_ms) break;
    const due = s.deadline_ms;
    if (s.phase === "peek") {
      s = { ...clone(s), phase: "talk", deadline_ms: due + s.talk_seconds * 1000 };
    } else if (s.phase === "talk") {
      s = { ...clone(s), phase: "pick", deadline_ms: due + SHIPO_SECONDS.pick * 1000 };
    } else if (s.phase === "pick") {
      s = resolveRound(s, null, due);
    } else if (s.phase === "result") {
      s = nextRound(s, due, rng);
    } else {
      break;
    }
    changed = true;
  }
  return { state: s, changed };
}

// ---------------------------------------------------------------------------
// 動作
// ---------------------------------------------------------------------------

export type ShipoActionResult =
  | { ok: true; state: ShipoState }
  | { ok: false; reason: "wrong_phase" | "not_judge" | "already_accused" | "invalid_target" | "not_in_game" };

function validTarget(s: ShipoState, userId: string, target: string): boolean {
  return target !== userId && target !== s.judge_id && s.order.includes(target) && !s.left.includes(target);
}

/** 公三小：想想、talk 階段、每輪限 1 次、目標不能是想想自己。 */
export function accuseShipo(state: ShipoState, userId: string, target: string): ShipoActionResult {
  if (state.phase !== "talk") return { ok: false, reason: "wrong_phase" };
  if (userId !== state.judge_id) return { ok: false, reason: "not_judge" };
  if (state.accuse !== null) return { ok: false, reason: "already_accused" };
  if (!validTarget(state, userId, target)) return { ok: false, reason: "invalid_target" };
  const s = clone(state);
  s.accuse = { target_id: target };
  return { ok: true, state: s };
}

/** 提前結束追問，進入指認。 */
export function endTalkShipo(state: ShipoState, userId: string, nowMs: number): ShipoActionResult {
  if (state.phase !== "talk") return { ok: false, reason: "wrong_phase" };
  if (userId !== state.judge_id) return { ok: false, reason: "not_judge" };
  const s = clone(state);
  s.phase = "pick";
  s.deadline_ms = nowMs + SHIPO_SECONDS.pick * 1000;
  return { ok: true, state: s };
}

/** 指認老實人並結算本輪。 */
export function pickShipo(state: ShipoState, userId: string, target: string, nowMs: number): ShipoActionResult {
  if (state.phase !== "pick") return { ok: false, reason: "wrong_phase" };
  if (userId !== state.judge_id) return { ok: false, reason: "not_judge" };
  if (!validTarget(state, userId, target)) return { ok: false, reason: "invalid_target" };
  return { ok: true, state: resolveRound(state, target, nowMs) };
}

/** result 階段「下一輪」：在場者全部確認就開下一輪（否則等 20 秒自動）。 */
export function nextShipo(
  state: ShipoState,
  userId: string,
  nowMs: number,
  rng: Rng = Math.random,
): ShipoActionResult {
  if (state.phase !== "result") return { ok: false, reason: "wrong_phase" };
  if (!activeIds(state).includes(userId)) return { ok: false, reason: "not_in_game" };
  let s = clone(state);
  if (!s.acks.includes(userId)) s.acks.push(userId);
  if (activeIds(s).every((id) => s.acks.includes(id))) s = nextRound(s, nowMs, rng);
  return { ok: true, state: s };
}

/** 離場（leave／kick）：在場不足 3 人直接結束；老實人／想想離場本輪作廢。 */
export function leaveShipo(
  state: ShipoState,
  userId: string,
  nowMs: number,
): { state: ShipoState; changed: boolean } {
  if (!state.order.includes(userId) || state.left.includes(userId) || state.phase === "over") {
    return { state, changed: false };
  }
  let s = clone(state);
  const role = s.roles[userId];
  s.left.push(userId);
  delete s.roles[userId];
  s.acks = s.acks.filter((id) => id !== userId);
  if (activeIds(s).length < SHIPO_MIN_PLAYERS - 1) return { state: finish(s), changed: true };
  if ((role === "judge" || role === "honest") && (s.phase === "peek" || s.phase === "talk" || s.phase === "pick")) {
    s = voidRound(s, nowMs);
    return { state: s, changed: true };
  }
  if (s.phase === "result" && activeIds(s).every((id) => s.acks.includes(id))) {
    s = nextRound(s, nowMs, Math.random);
  }
  return { state: s, changed: true };
}

/** 聊天權限：peek 全員禁言（閉眼）；over 之外只有在場者能發。 */
export function canSendTextShipo(state: ShipoState, userId: string): { ok: true } | { ok: false; reason: string } {
  if (state.phase === "over") return { ok: true };
  if (!state.order.includes(userId) || state.left.includes(userId)) return { ok: false, reason: "你已離場" };
  if (state.phase === "peek") return { ok: false, reason: "閉眼中，先別說話" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 視圖（按人裁剪）
// ---------------------------------------------------------------------------

export type ShipoViewJson = {
  round: number;
  rounds_total: number;
  phase: ShipoPhase;
  deadline: string | null;
  server_now: string;
  seconds: { peek: number; talk: number; pick: number; result: number };
  judge_id: string;
  card: { code: string; difficulty: number; category: string };
  me: {
    role: ShipoRole | null;
    /** 僅老實人、僅 peek 階段 */
    truth: { text: string; source: string } | null;
  };
  accuse: { target_id: string } | null;
  picked: { target_id: string } | null;
  scores: Record<string, number>;
  acks: string[];
  left: string[];
  result: (ShipoResult & { truth: { text: string; source: string }; title: string }) | null;
  winners: string[] | null;
};

export function viewShipoFor(state: ShipoState, userId: string, nowMs: number, lang: ShipoLang): ShipoViewJson {
  const card = shipoCardByCode(state.card_code);
  const myRole = state.roles[userId] ?? null;
  const reveal = state.phase === "result" || state.phase === "over";
  return {
    round: state.round,
    rounds_total: state.rounds_total,
    phase: state.phase,
    deadline: state.deadline_ms === null ? null : new Date(state.deadline_ms).toISOString(),
    server_now: new Date(nowMs).toISOString(),
    seconds: { ...SHIPO_SECONDS, talk: state.talk_seconds },
    judge_id: state.judge_id,
    card: { code: state.card_code, difficulty: card?.difficulty ?? 1, category: card?.category[lang] ?? "" },
    me: {
      role: myRole,
      truth:
        state.phase === "peek" && myRole === "honest" && card !== null
          ? { text: card.truth[lang], source: card.source[lang] }
          : null,
    },
    accuse: state.accuse === null ? null : { ...state.accuse },
    picked: state.picked === null ? null : { target_id: state.picked },
    scores: { ...state.scores },
    acks: [...state.acks],
    left: [...state.left],
    result:
      reveal && state.result !== null && card !== null
        ? { ...state.result, truth: { text: card.truth[lang], source: card.source[lang] }, title: card.title[lang] }
        : null,
    winners: state.winners === null ? null : [...state.winners],
  };
}

export function parseShipoState(raw: unknown): ShipoState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.order) || typeof r.phase !== "string") return null;
  return raw as ShipoState;
}
