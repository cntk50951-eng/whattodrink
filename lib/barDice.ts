/**
 * Bar 大話骰（用戶 vs Ivy）：服務端權威的純邏輯（無 IO，可單測）。
 * 玩法＝香港酒吧版（Wikipedia「大話骰」）：每人固定 N 粒（默認 5，可選 3–6）、骰數不會減少；
 * 叫「數量＋點數」；加注＝數量更多或同量點大；1 點百搭；開骰時全場亮骰，實際數 ≥ 叫數 → 質疑者輸，否則叫骰者輸。
 * **一鋪（一局）定輸贏**：開骰就結束，贏的 +3 次聊天、輸的 −1 次（輸家飲 → 這裡扣一次聊天）；下一鋪從輸家開叫。
 * （先前誤做成「輸家少一粒、骰光出局」的國際淘汰版 Dudo／Perudo，用戶回報骰越玩越少、積分不變，已改。）
 * 骰子與 Ivy 的叫骰全在服務端：客戶端只送「叫什麼／質疑」，沒有任何「我贏了」的欄位可以偽造。
 * 設計：whattodrink_ios/docs/plans/bar-dice-credits-design.md
 */
import { randomInt } from "node:crypto";

import { countMatching, isValidBid, LIARS_RULES_DEFAULT, rollDice, type LiarsRules } from "./games/liars";

export const BAR_DICE = {
  /** 每人骰數：默認 5（香港酒吧標準），可自選 3–6 */
  defaultDice: 5,
  minDice: 3,
  maxDice: 6,
  /** 開叫最小數量（兩個人＝至少 2 個） */
  minOpenQty: 2,
  /** 每日最多開幾鋪（一鋪約半分鐘；防刷） */
  startsPerDay: 60,
  /** 超過多久沒動作的進行中對局，視為放棄（算輸） */
  staleMinutes: 30,
} as const;

export const BAR_DICE_RULES: LiarsRules = {
  ...LIARS_RULES_DEFAULT,
  dice_per_player: BAR_DICE.defaultDice,
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
};

export type DiceLogEntry = { round: number; who: Seat; act: "bid" | "challenge"; qty?: number; face?: number };

/** 存進 bar_dice_matches.state 的完整狀態（含 Ivy 的骰；絕不原樣回給客戶端）。 */
export type DiceState = {
  v: 1;
  rev: number;
  /** 每人骰數（整鋪固定） */
  dice: number;
  /** 誰先叫（上一鋪的輸家） */
  opener: Seat;
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

// ───────────────────────── 一鋪的狀態機 ─────────────────────────

export function clampDice(n: unknown): number {
  const v = typeof n === "number" && Number.isInteger(n) ? n : BAR_DICE.defaultDice;
  return Math.min(BAR_DICE.maxDice, Math.max(BAR_DICE.minDice, v));
}

/** 開一鋪：兩邊各 N 粒；`opener` 先叫（第一鋪用戶先叫，之後輸家先叫）。Ivy 先叫時會當場叫出第一手。 */
export function newMatch(dice: number = BAR_DICE.defaultDice, opener: Seat = "me", rng: Rng = cryptoRng): DiceState {
  const n = clampDice(dice);
  const base: DiceState = { v: 1, rev: 0, dice: n, opener, me: rollDice(n, rng.int), ivy: rollDice(n, rng.int), bid: null, turn: opener, winner: null, log: [] };
  return ivyPlays(base, rng, []);
}

export function totalDice(s: DiceState): number {
  return s.me.length + s.ivy.length;
}

export type StepResult =
  | { ok: true; state: DiceState; reveals: DiceReveal[] }
  | { ok: false; code: "not_your_turn" | "wrong_phase" | "invalid_bid"; message: string };

const other = (s: Seat): Seat => (s === "me" ? "ivy" : "me");

/** 開骰：全場亮骰、定輸贏（一鋪到此結束；骰數不變）。 */
function resolve(s: DiceState, challenger: Seat): { state: DiceState; reveal: DiceReveal } {
  const bid = s.bid;
  if (bid === null) throw new Error("resolve without bid");
  const rules = { ...BAR_DICE_RULES, dice_per_player: s.dice };
  const counted = countMatching([...s.me, ...s.ivy], { qty: bid.qty, face: bid.face, zhai: false }, rules);
  const met = counted >= bid.qty;
  const loser: Seat = met ? challenger : bid.by;
  const reveal: DiceReveal = {
    challenger,
    bidder: bid.by,
    bid: { qty: bid.qty, face: bid.face },
    counted,
    bid_met: met,
    loser,
    hands: { me: [...s.me], ivy: [...s.ivy] },
  };
  const next: DiceState = { ...s, winner: other(loser), turn: loser, log: [...s.log, { round: 1, who: challenger, act: "challenge" }] };
  return { state: next, reveal };
}

/** Ivy 的回合：叫或開（輪到用戶或這鋪結束就停）。 */
function ivyPlays(start: DiceState, rng: Rng, reveals: DiceReveal[]): DiceState {
  let s = start;
  for (let guard = 0; guard < 12 && s.winner === null && s.turn === "ivy"; guard += 1) {
    const rules = { ...BAR_DICE_RULES, dice_per_player: s.dice };
    const move = ivyDecide(s.ivy, totalDice(s), s.bid === null ? null : { qty: s.bid.qty, face: s.bid.face }, rng, rules);
    if (move.kind === "challenge" && s.bid !== null) {
      const r = resolve(s, "ivy");
      reveals.push(r.reveal);
      s = r.state;
    } else {
      const b = move.kind === "bid" ? move.bid : legalBids(null, totalDice(s), rules)[0];
      if (b === undefined) break;
      s = { ...s, bid: { ...b, by: "ivy" }, turn: "me", log: [...s.log, { round: 1, who: "ivy", act: "bid", qty: b.qty, face: b.face }] };
    }
  }
  return s;
}

function validate(state: DiceState): StepResult | null {
  if (state.winner !== null) return { ok: false, code: "wrong_phase", message: "這鋪已經結束。" };
  if (state.turn !== "me") return { ok: false, code: "not_your_turn", message: "還沒輪到你。" };
  return null;
}

/** 用戶叫骰：校驗 → 記錄 → 輪到 Ivy（她叫或開盅）。 */
export function applyBid(state: DiceState, bid: Bid, rng: Rng = cryptoRng): StepResult {
  const bad = validate(state);
  if (bad !== null) return bad;
  const rules = { ...BAR_DICE_RULES, dice_per_player: state.dice };
  const v = isValidBid(state.bid === null ? null : { qty: state.bid.qty, face: state.bid.face, zhai: false }, { qty: bid.qty, face: bid.face }, rules);
  if (!v.ok) return { ok: false, code: "invalid_bid", message: v.reason };
  if (bid.qty > totalDice(state)) return { ok: false, code: "invalid_bid", message: "數量超過場上骰子總數。" };
  const reveals: DiceReveal[] = [];
  let s: DiceState = { ...state, bid: { ...bid, by: "me" }, turn: "ivy", log: [...state.log, { round: 1, who: "me", act: "bid", qty: bid.qty, face: bid.face }] };
  s = ivyPlays(s, rng, reveals);
  return { ok: true, state: { ...s, rev: state.rev + 1 }, reveals };
}

/** 用戶開骰（質疑 Ivy 剛才的叫骰）：這鋪當場結束。 */
export function applyChallenge(state: DiceState): StepResult {
  const bad = validate(state);
  if (bad !== null) return bad;
  if (state.bid === null || state.bid.by !== "ivy") return { ok: false, code: "wrong_phase", message: "現在沒有可以開的叫骰。" };
  const r = resolve(state, "me");
  return { ok: true, state: { ...r.state, rev: state.rev + 1 }, reveals: [r.reveal] };
}

// ───────────────────────── 給客戶端的視圖 ─────────────────────────

export type DiceView = {
  match_id: string;
  status: "active" | "won" | "lost" | "abandoned";
  rules: { dice_per_player: number; min_open_qty: number; ones_wild: boolean };
  my_dice: number[];
  ivy_dice_count: number;
  total_dice: number;
  bid: { qty: number; face: number; by: Seat } | null;
  turn: Seat;
  /** 輪到你且 Ivy 剛叫過 → 可質疑 */
  can_challenge: boolean;
  log: DiceLogEntry[];
  /** 這鋪的贏家（結束後才有） */
  winner: Seat | null;
};

/** 把完整狀態收斂成客戶端看得到的（隱藏 Ivy 的骰；結束後才揭曉在 reveal 裡）。 */
export function toView(matchId: string, status: DiceView["status"], s: DiceState): DiceView {
  return {
    match_id: matchId,
    status,
    rules: { dice_per_player: s.dice, min_open_qty: BAR_DICE.minOpenQty, ones_wild: true },
    my_dice: s.me,
    ivy_dice_count: s.ivy.length,
    total_dice: totalDice(s),
    bid: s.bid,
    turn: s.turn,
    can_challenge: s.winner === null && s.turn === "me" && s.bid !== null && s.bid.by === "ivy",
    log: s.log.slice(-12),
    winner: s.winner,
  };
}
