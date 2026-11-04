/**
 * Bar 大話骰（用戶 vs Ivy）：服務端權威的純邏輯（無 IO，可單測）。
 * 規則沿 lib/games/liars.ts：每人 3 粒；叫「數量＋點數」；加注＝數量更多或同量點大；1 點百搭；
 * 質疑時全場亮骰，實際數 ≥ 叫數 → 質疑者輸，否則叫骰者輸；輸家少一粒，歸零出局＝輸整局。
 * 骰子與 Ivy 的叫骰全在服務端：客戶端只送「叫什麼／質疑」，沒有任何「我贏了」的欄位可以偽造。
 * 設計：whattodrink_ios/docs/plans/bar-dice-credits-design.md
 */
import { randomInt } from "node:crypto";

import { countMatching, isValidBid, LIARS_RULES_DEFAULT, rollDice, type LiarsRules } from "./games/liars";

export const BAR_DICE = {
  /** 每人起始骰數 */
  dicePerPlayer: 3,
  /** 開局最小叫骰數量 */
  minOpenQty: 2,
  /** 每日最多開幾局（防刷） */
  startsPerDay: 20,
  /** 超過多久沒動作的進行中對局，視為放棄（算輸） */
  staleMinutes: 30,
} as const;

export const BAR_DICE_RULES: LiarsRules = {
  ...LIARS_RULES_DEFAULT,
  dice_per_player: BAR_DICE.dicePerPlayer,
  min_open_qty: BAR_DICE.minOpenQty,
  ones_wild: true,
  ones_break: false,
  zhai_enabled: false,
};

export type Seat = "me" | "ivy";
export type Bid = { qty: number; face: number };

export type DiceReveal = {
  challenger: Seat;
  bidder: Seat;
  bid: Bid;
  counted: number;
  /** 叫數成立 → 質疑者輸 */
  bid_met: boolean;
  loser: Seat;
  hands: { me: number[]; ivy: number[] };
  loser_out: boolean;
};

export type DiceLogEntry = { round: number; who: Seat; act: "bid" | "challenge"; qty?: number; face?: number };

/** 存進 bar_dice_matches.state 的完整狀態（含 Ivy 的骰；絕不原樣回給客戶端）。 */
export type DiceState = {
  v: 1;
  rev: number;
  round: number;
  me: number[];
  ivy: number[];
  bid: (Bid & { by: Seat }) | null;
  turn: Seat;
  winner: Seat | null;
  log: DiceLogEntry[];
};

export type Rng = {
  /** [min, max) 整數 */
  int: (min: number, maxExclusive: number) => number;
  /** [0, 1) */
  float: () => number;
};

export const cryptoRng: Rng = {
  int: (min, max) => randomInt(min, max),
  float: () => randomInt(0, 1_000_000) / 1_000_000,
};

// ───────────────────────── Ivy 的機器人 ─────────────────────────

/** 難度：只調三件事（和 iOS 練習模式同一套）。數字用來把「用戶勝率」調到約 45%。 */
export type BotParams = {
  /** 開盅門檻：叫數成立機率低於它就開 */
  challengeThreshold: number;
  /** 隨機抖動幅度 */
  jitter: number;
  /** 虛張聲勢的機率 */
  bluffChance: number;
};

export const IVY_BOT: BotParams = {
  challengeThreshold: 0.33,
  jitter: 0.07,
  bluffChance: 0.15,
};

function hitChance(face: number, rules: LiarsRules): number {
  return rules.ones_wild && face !== 1 ? 1 / 3 : 1 / 6;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < Math.min(k, n - k); i += 1) r = (r * (n - i)) / (i + 1);
  return r;
}

/** n 顆骰、每顆命中機率 p，至少 need 顆命中的機率 */
export function probAtLeast(need: number, n: number, p: number): number {
  if (need <= 0) return 1;
  if (need > n) return 0;
  let total = 0;
  for (let k = need; k <= n; k += 1) total += binomial(n, k) * p ** k * (1 - p) ** (n - k);
  return Math.min(1, Math.max(0, total));
}

/** 站在持有 `own` 的座位看，這一叫成立的機率 */
export function successChance(b: Bid, own: number[], totalDice: number, rules: LiarsRules): number {
  const mine = own.filter((d) => d === b.face || (rules.ones_wild && b.face !== 1 && d === 1)).length;
  return probAtLeast(b.qty - mine, Math.max(0, totalDice - own.length), hitChance(b.face, rules));
}

/** 場上所有「合法的下一叫」，由小到大 */
export function legalBids(prev: Bid | null, totalDice: number, rules: LiarsRules = BAR_DICE_RULES): Bid[] {
  const out: Bid[] = [];
  for (let q = 1; q <= totalDice; q += 1) {
    for (let f = 1; f <= 6; f += 1) {
      if (isValidBid(prev === null ? null : { ...prev, zhai: false }, { qty: q, face: f }, rules).ok) out.push({ qty: q, face: f });
    }
  }
  return out;
}

export type BotMove = { kind: "challenge" } | { kind: "bid"; bid: Bid };

/** Ivy 的決策：按手上的骰＋場上未知骰的二項分佈估算，低於門檻就開，否則在小幅加注裡挑最穩的（偶爾唬人）。 */
export function ivyDecide(own: number[], totalDice: number, prev: Bid | null, rng: Rng, rules: LiarsRules = BAR_DICE_RULES, bot: BotParams = IVY_BOT): BotMove {
  if (prev !== null) {
    const p = successChance(prev, own, totalDice, rules);
    const jitter = (rng.float() * 2 - 1) * bot.jitter;
    if (p < bot.challengeThreshold + jitter) return { kind: "challenge" };
  }
  const legal = legalBids(prev, totalDice, rules);
  if (legal.length === 0) return { kind: "challenge" };
  const base = prev?.qty ?? rules.min_open_qty;
  const near = legal.filter((b) => b.qty <= base + 2);
  const pool = near.length > 0 ? near : legal;
  const scored = pool
    .map((b) => ({ bid: b, chance: successChance(b, own, totalDice, rules) }))
    .sort((a, b) => b.chance - a.chance || a.bid.qty - b.bid.qty || a.bid.face - b.bid.face);
  const best = scored[0];
  if (best === undefined) return { kind: "challenge" };
  if (prev !== null && best.chance < 0.12) return { kind: "challenge" };
  if (scored.length > 3 && rng.float() < bot.bluffChance) {
    const pick = scored[Math.min(scored.length - 1, 3 + rng.int(0, Math.min(3, scored.length - 3)))];
    if (pick !== undefined) return { kind: "bid", bid: pick.bid };
  }
  return { kind: "bid", bid: best.bid };
}

// ───────────────────────── 對局狀態機 ─────────────────────────

/** 開新局：兩邊各 3 粒，用戶先叫 */
export function newMatch(rng: Rng = cryptoRng): DiceState {
  const roll = (n: number): number[] => rollDice(n, rng.int);
  return { v: 1, rev: 0, round: 1, me: roll(BAR_DICE.dicePerPlayer), ivy: roll(BAR_DICE.dicePerPlayer), bid: null, turn: "me", winner: null, log: [] };
}

export function totalDice(s: DiceState): number {
  return s.me.length + s.ivy.length;
}

export type StepResult =
  | { ok: true; state: DiceState; reveals: DiceReveal[] }
  | { ok: false; code: "not_your_turn" | "wrong_phase" | "invalid_bid"; message: string };

const other = (s: Seat): Seat => (s === "me" ? "ivy" : "me");

function resolve(s: DiceState, challenger: Seat, rng: Rng): { state: DiceState; reveal: DiceReveal } {
  const bid = s.bid;
  if (bid === null) throw new Error("resolve without bid");
  const counted = countMatching([...s.me, ...s.ivy], { qty: bid.qty, face: bid.face, zhai: false }, BAR_DICE_RULES);
  const met = counted >= bid.qty;
  const loser: Seat = met ? challenger : bid.by;
  const hands = { me: [...s.me], ivy: [...s.ivy] };
  const next: DiceState = { ...s, me: [...s.me], ivy: [...s.ivy], log: [...s.log, { round: s.round, who: challenger, act: "challenge" }] };
  next[loser] = next[loser].slice(0, -1);
  const out = next[loser].length === 0;
  const reveal: DiceReveal = { challenger, bidder: bid.by, bid: { qty: bid.qty, face: bid.face }, counted, bid_met: met, loser, hands, loser_out: out };
  if (out) {
    next.winner = other(loser);
    next.bid = null;
    return { state: next, reveal };
  }
  // 下一回合：兩邊按剩餘骰數重新發骰，輸家先叫
  next.me = rollDice(next.me.length, rng.int);
  next.ivy = rollDice(next.ivy.length, rng.int);
  next.bid = null;
  next.round = s.round + 1;
  next.turn = loser;
  return { state: next, reveal };
}

/** Ivy 連續行動，直到輪到用戶或整局結束（Ivy 輸掉回合時由她開下一回合的第一叫；Ivy 質疑時開盅）。 */
function ivyPlays(start: DiceState, rng: Rng, reveals: DiceReveal[]): DiceState {
  let s = start;
  for (let guard = 0; guard < 12 && s.winner === null && s.turn === "ivy"; guard += 1) {
    const move = ivyDecide(s.ivy, totalDice(s), s.bid === null ? null : { qty: s.bid.qty, face: s.bid.face }, rng);
    if (move.kind === "challenge" && s.bid !== null) {
      const r = resolve(s, "ivy", rng);
      reveals.push(r.reveal);
      s = r.state;
    } else {
      const b = move.kind === "bid" ? move.bid : legalBids(null, totalDice(s))[0];
      if (b === undefined) break;
      s = { ...s, bid: { ...b, by: "ivy" }, turn: "me", log: [...s.log, { round: s.round, who: "ivy", act: "bid", qty: b.qty, face: b.face }] };
    }
  }
  return s;
}

/** 用戶叫骰：校驗 → 記錄 → 輪到 Ivy（她叫或質疑，可能連著開下一回合）。 */
export function applyBid(state: DiceState, bid: Bid, rng: Rng = cryptoRng): StepResult {
  if (state.winner !== null) return { ok: false, code: "wrong_phase", message: "這局已經結束。" };
  if (state.turn !== "me") return { ok: false, code: "not_your_turn", message: "還沒輪到你。" };
  const v = isValidBid(state.bid === null ? null : { qty: state.bid.qty, face: state.bid.face, zhai: false }, { qty: bid.qty, face: bid.face }, BAR_DICE_RULES);
  if (!v.ok) return { ok: false, code: "invalid_bid", message: v.reason };
  if (bid.qty > totalDice(state)) return { ok: false, code: "invalid_bid", message: "數量超過場上骰子總數。" };
  const reveals: DiceReveal[] = [];
  let s: DiceState = { ...state, bid: { ...bid, by: "me" }, turn: "ivy", log: [...state.log, { round: state.round, who: "me", act: "bid", qty: bid.qty, face: bid.face }] };
  s = ivyPlays(s, rng, reveals);
  return { ok: true, state: { ...s, rev: state.rev + 1 }, reveals };
}

/** 用戶質疑 Ivy 剛才的叫骰。 */
export function applyChallenge(state: DiceState, rng: Rng = cryptoRng): StepResult {
  if (state.winner !== null) return { ok: false, code: "wrong_phase", message: "這局已經結束。" };
  if (state.turn !== "me") return { ok: false, code: "not_your_turn", message: "還沒輪到你。" };
  if (state.bid === null || state.bid.by !== "ivy") return { ok: false, code: "wrong_phase", message: "現在沒有可以質疑的叫骰。" };
  const reveals: DiceReveal[] = [];
  const r = resolve(state, "me", rng);
  reveals.push(r.reveal);
  let s = r.state;
  s = ivyPlays(s, rng, reveals);
  return { ok: true, state: { ...s, rev: state.rev + 1 }, reveals };
}

/** 開局後若輪到 Ivy（目前開局用戶先叫，保留給之後調整）。 */
export function afterStart(state: DiceState, rng: Rng = cryptoRng): DiceState {
  const reveals: DiceReveal[] = [];
  return ivyPlays(state, rng, reveals);
}

// ───────────────────────── 給客戶端的視圖 ─────────────────────────

export type DiceView = {
  match_id: string;
  status: "active" | "won" | "lost" | "abandoned";
  rules: { dice_per_player: number; min_open_qty: number; ones_wild: boolean };
  round: number;
  my_dice: number[];
  ivy_dice_count: number;
  total_dice: number;
  bid: { qty: number; face: number; by: Seat } | null;
  turn: Seat;
  /** 輪到你且 Ivy 剛叫過 → 可質疑 */
  can_challenge: boolean;
  log: DiceLogEntry[];
};

/** 把完整狀態收斂成客戶端看得到的（隱藏 Ivy 的骰；結束後才揭曉在 reveal 裡）。 */
export function toView(matchId: string, status: DiceView["status"], s: DiceState): DiceView {
  return {
    match_id: matchId,
    status,
    rules: { dice_per_player: BAR_DICE.dicePerPlayer, min_open_qty: BAR_DICE.minOpenQty, ones_wild: true },
    round: s.round,
    my_dice: s.me,
    ivy_dice_count: s.ivy.length,
    total_dice: totalDice(s),
    bid: s.bid,
    turn: s.turn,
    can_challenge: s.winner === null && s.turn === "me" && s.bid !== null && s.bid.by === "ivy",
    log: s.log.slice(-12),
  };
}
