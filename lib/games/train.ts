import { TRAIN_CATS, TRAIN_PACKS, type TrainCat, type TrainPack } from "./trainWords";

/**
 * UR H.4 尾班車（真聯機）— 純函數狀態機，不碰 DB／網絡／時鐘（時間一律由調用方傳 nowMs）。
 * 玩法：題目是某個題庫（港鐵某綫站名、茶記、廣東歌手…）。輪到你就打一個題庫裡有、而且沒人講過的答案，
 * 答啱即傳畀下一位；**隱藏的倒數**歸零時仍然拿著車的人罰（冇上到尾班車）。
 *
 * 秘密：倒數真實長度與截止時間只在 server（`fuse_deadline_ms`／`fuse_total_ms`），絕不下發。
 * 客戶端只拿到量化的「熱度」0–4（越高越緊張，用來加速滴答聲與震動），算不出還剩幾秒。
 * 答案驗證只在 server（題庫在 server，手機端不可信）。
 * 狀態整份存 `train_states.state`（0068，RLS 全拒，只 service_role 讀寫）。
 */

export const TRAIN_MIN_PLAYERS = 3;
export const TRAIN_MAX_PLAYERS = 8;

export type TrainFuse = "short" | "mid" | "long";
/** 倒數長度範圍（秒）：開局在範圍內隨機取一個，隱藏 */
export const TRAIN_FUSE_SECONDS: Record<TrainFuse, readonly [number, number]> = {
  short: [15, 30],
  mid: [25, 50],
  long: [40, 80],
};

export type TrainRules = { packs: TrainPack[]; fuse: TrainFuse; events: boolean };

const DEFAULT_PACKS: TrainPack[] = ["mtr", "cha", "can", "cock"];

export function parseTrainRules(raw: unknown): TrainRules {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const packs = Array.isArray(r.packs)
    ? [...new Set(r.packs.filter((p): p is TrainPack => (TRAIN_PACKS as readonly unknown[]).includes(p)))]
    : [];
  return {
    packs: packs.length > 0 ? packs : [...DEFAULT_PACKS],
    fuse: r.fuse === "short" || r.fuse === "long" ? r.fuse : "mid",
    events: typeof r.events === "boolean" ? r.events : true,
  };
}

export type TrainEventId = "rev" | "skip" | "xfer" | "rush";
export type TrainEvent = { seq: number; id: TrainEventId; /** skip：被跳過的人 */ target?: string };
export type TrainLogEntry = { seq: number; by: string; text: string; cat: string; at_ms: number };

export type TrainState = {
  v: 1;
  phase: "run" | "over";
  rules: TrainRules;
  /** 座位序的在座玩家（離場者移除） */
  order: string[];
  holder: string;
  /** 傳遞方向：1 順位次、-1 反向 */
  dir: 1 | -1;
  passes: number;
  cat: string;
  /** 已講過的答案（`${catId}:${首個別名}`） */
  used: string[];
  /** 秘密：倒數截止（epoch ms）與開始時的總長 */
  fuse_deadline_ms: number;
  started_ms: number;
  fuse_total_ms: number;
  log: TrainLogEntry[];
  event: TrainEvent | null;
  seq: number;
  loser: string | null;
};

export type Rng = () => number;

const LOG_MAX = 60;

export function catOf(id: string): TrainCat | undefined {
  return TRAIN_CATS.find((c) => c.id === id);
}

function poolOf(rules: TrainRules): TrainCat[] {
  const pool = TRAIN_CATS.filter((c) => rules.packs.includes(c.pack));
  return pool.length > 0 ? pool : [...TRAIN_CATS];
}

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(lo: number, hi: number, rng: Rng): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// ---------------------------------------------------------------------------
// 答案比對
// ---------------------------------------------------------------------------

/** 正規化：去空白、小寫；站名／區名題另外忽略結尾的「站／綫／線／區」 */
export function normalizeAnswer(text: string, cat: TrainCat): string {
  let x = text.trim().toLowerCase().replace(/\s+/g, "");
  if (cat.norm === "stn") x = x.replace(/[站綫線區]$/, "");
  return x;
}

/** 在題庫裡找答案（任一別名命中即可）；找不到回 null */
export function matchAnswer(cat: TrainCat, text: string): readonly string[] | null {
  const q = normalizeAnswer(text, cat);
  if (q === "") return null;
  return cat.items.find((it) => it.some((a) => normalizeAnswer(a, cat) === q)) ?? null;
}

function usedKey(cat: TrainCat, item: readonly string[]): string {
  return `${cat.id}:${item[0]}`;
}

export function unusedCount(state: TrainState, cat: TrainCat): number {
  return cat.items.filter((it) => !state.used.includes(usedKey(cat, it))).length;
}

// ---------------------------------------------------------------------------
// 開局與轉移（全部回新 state，不改入參）
// ---------------------------------------------------------------------------

function clone(s: TrainState): TrainState {
  return JSON.parse(JSON.stringify(s)) as TrainState;
}

/** 開局。`holder` 缺省＝隨機；再來一局時傳上局輸家。人數須 3–8，否則回 error（不拋）。 */
export function createTrainState(
  playerIds: readonly string[],
  rules: TrainRules,
  nowMs: number,
  rng: Rng = Math.random,
  holder?: string,
): TrainState | { error: string } {
  const n = playerIds.length;
  if (n < TRAIN_MIN_PLAYERS || n > TRAIN_MAX_PLAYERS) {
    return { error: `人數需 ${TRAIN_MIN_PLAYERS}–${TRAIN_MAX_PLAYERS} 人` };
  }
  const [lo, hi] = TRAIN_FUSE_SECONDS[rules.fuse];
  const fuseMs = randInt(lo, hi, rng) * 1000;
  const start = holder !== undefined && playerIds.includes(holder) ? holder : pick(playerIds, rng);
  return {
    v: 1,
    phase: "run",
    rules,
    order: [...playerIds],
    holder: start,
    dir: 1,
    passes: 0,
    cat: pick(poolOf(rules), rng).id,
    used: [],
    fuse_deadline_ms: nowMs + fuseMs,
    started_ms: nowMs,
    fuse_total_ms: fuseMs,
    log: [],
    event: null,
    seq: 0,
    loser: null,
  };
}

function stepFrom(order: readonly string[], from: string, dir: 1 | -1, steps: number): string {
  const i = Math.max(0, order.indexOf(from));
  const n = order.length;
  return order[(((i + dir * steps) % n) + n) % n];
}

/**
 * 倒數到點（懶結算，GET／動作前調用）：仍拿著車的人輸，局結束。
 * 回 `{state, changed}`；沒到點回原物件。
 */
export function advanceTrain(state: TrainState, nowMs: number): { state: TrainState; changed: boolean } {
  if (state.phase !== "run" || nowMs < state.fuse_deadline_ms) return { state, changed: false };
  const s = clone(state);
  s.phase = "over";
  s.loser = s.holder;
  return { state: s, changed: true };
}

export type TrainAnswerResult =
  | { ok: true; state: TrainState; text: string }
  | { ok: false; reason: "wrong_phase" | "not_your_turn" | "not_in_bank" | "duplicate" };

/**
 * 答題。只有拿著車的人可答；答錯（不在題庫）或重複不會傳車、倒數照走。
 * 答啱→記錄、傳給下一位；之後可能觸發隨機事件（調頭／越站／轉線／趕車）；題目答晒自動轉題，全部答晒則立即爆。
 */
export function answerTrain(
  state: TrainState,
  userId: string,
  text: string,
  nowMs: number,
  rng: Rng = Math.random,
): TrainAnswerResult {
  if (state.phase !== "run") return { ok: false, reason: "wrong_phase" };
  if (state.holder !== userId) return { ok: false, reason: "not_your_turn" };
  const cat = catOf(state.cat);
  if (cat === undefined) return { ok: false, reason: "not_in_bank" };
  const item = matchAnswer(cat, text);
  if (item === null) return { ok: false, reason: "not_in_bank" };
  if (state.used.includes(usedKey(cat, item))) return { ok: false, reason: "duplicate" };

  const s = clone(state);
  s.used.push(usedKey(cat, item));
  s.passes += 1;
  s.seq += 1;
  s.log.push({ seq: s.seq, by: userId, text: item[0], cat: cat.id, at_ms: nowMs });
  if (s.log.length > LOG_MAX) s.log = s.log.slice(-LOG_MAX);

  let step = 1;
  s.event = null;
  if (s.rules.events && s.passes >= 3 && rng() < 0.3) {
    const others = poolOf(s.rules).filter((c) => c.id !== s.cat && unusedCount(s, c) > 0);
    const options: TrainEventId[] = ["rev", "skip", "rush", ...(others.length > 0 ? (["xfer"] as const) : [])];
    const id = pick(options, rng);
    s.seq += 1;
    if (id === "rev") {
      s.dir = s.dir === 1 ? -1 : 1;
      s.event = { seq: s.seq, id };
    } else if (id === "skip") {
      step = 2;
      s.event = { seq: s.seq, id, target: stepFrom(s.order, s.holder, s.dir, 1) };
    } else if (id === "xfer") {
      s.cat = pick(others, rng).id;
      s.event = { seq: s.seq, id };
    } else {
      // 趕車：剩餘時間縮成 60%
      const left = Math.max(0, s.fuse_deadline_ms - nowMs);
      s.fuse_deadline_ms = nowMs + left * 0.6;
      s.event = { seq: s.seq, id };
    }
  }
  s.holder = stepFrom(s.order, s.holder, s.dir, step);

  // 題目答晒→轉去還有答案的題；全部答晒→立即爆（輸家＝此刻拿著車的人）
  const cur = catOf(s.cat);
  if (cur === undefined || unusedCount(s, cur) === 0) {
    const rest = poolOf(s.rules).filter((c) => unusedCount(s, c) > 0);
    if (rest.length > 0) s.cat = pick(rest, rng).id;
    else s.fuse_deadline_ms = nowMs;
  }
  return { ok: true, state: s, text: item[0] };
}

/**
 * 玩家離場：從座位序移除；拿著車的人離場→車交給下一位（不算傳遞）。
 * 剩不到 2 人→局結束（沒有輸家）。
 */
export function leaveTrain(state: TrainState, userId: string): { state: TrainState; changed: boolean } {
  if (state.phase !== "run" || !state.order.includes(userId)) return { state, changed: false };
  const s = clone(state);
  const next = s.holder === userId ? stepFrom(s.order, userId, s.dir, 1) : s.holder;
  s.order = s.order.filter((id) => id !== userId);
  if (s.order.length < 2) {
    s.phase = "over";
    s.loser = null;
    return { state: s, changed: true };
  }
  s.holder = s.order.includes(next) ? next : s.order[0];
  return { state: s, changed: true };
}

// ---------------------------------------------------------------------------
// 按人裁剪的視圖（GET 用）。絕不含倒數的真實截止時間或總長。
// ---------------------------------------------------------------------------

export type TrainViewJson = {
  phase: "run" | "over";
  server_now: string;
  holder: string;
  dir: 1 | -1;
  passes: number;
  order: string[];
  cat: { id: string; name: string; color: string; prompt: string; remaining: number } | null;
  /** 熱度 0–4（倒數已走的比例量化成五格）：只用來加速滴答聲與震動，算不出剩餘秒數 */
  heat: number;
  loser: string | null;
  /** 最近的答案流（公開） */
  log: Array<{ seq: number; by: string; text: string; cat: string; color: string; at: string }>;
  /** 最近一次隨機事件（seq 單調遞增，客戶端按 seq 只提示一次） */
  event: { seq: number; id: TrainEventId; target: string | null } | null;
  rules: TrainRules;
};

export function trainHeat(state: TrainState, nowMs: number): number {
  if (state.phase === "over") return 4;
  const total = Math.max(1, state.fuse_deadline_ms - state.started_ms);
  const p = (nowMs - state.started_ms) / total;
  return Math.min(4, Math.max(0, Math.floor(p * 5)));
}

export function viewTrainFor(state: TrainState, nowMs: number): TrainViewJson {
  const cat = catOf(state.cat);
  return {
    phase: state.phase,
    server_now: new Date(nowMs).toISOString(),
    holder: state.holder,
    dir: state.dir,
    passes: state.passes,
    order: [...state.order],
    cat:
      cat === undefined
        ? null
        : { id: cat.id, name: cat.name, color: cat.color, prompt: cat.prompt, remaining: unusedCount(state, cat) },
    heat: trainHeat(state, nowMs),
    loser: state.loser,
    log: state.log.slice(-30).map((e) => ({
      seq: e.seq,
      by: e.by,
      text: e.text,
      cat: e.cat,
      color: catOf(e.cat)?.color ?? "#FFB43A",
      at: new Date(e.at_ms).toISOString(),
    })),
    event: state.event === null ? null : { seq: state.event.seq, id: state.event.id, target: state.event.target ?? null },
    rules: state.rules,
  };
}

export function parseTrainState(raw: unknown): TrainState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.order) || typeof r.holder !== "string") return null;
  return raw as TrainState;
}
