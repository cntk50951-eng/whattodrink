/**
 * Bar 21點（用戶 vs Ivy，對手模式）：服務端權威的純邏輯（無 IO，可單測）。
 * 設計：whattodrink_ios/docs/plans/bar-blackjack-design.md
 *
 * 規則：1 副牌每鋪重洗；各兩張（Ivy 一明一暗）；我先操作（要牌／停牌／加倍），再輪 Ivy（每一步要牌或停牌）。
 * 加倍＝只限頭兩張，拿剛好一張後自動停牌，積分結果不變。Blackjack＝頭兩張 A＋10 點牌；雙方都有＝平。
 * 勝負：我爆＝輸；Ivy 爆＝贏；有 Blackjack 的贏沒有的；同點平；否則點大的贏。
 *
 * 邊界（和大話骰 AI 叫骰一致）：Ivy 的決策輸入只能是「真人在桌邊看得到的」＋機率：
 * 她自己的牌、我拿了幾張牌、我停牌快慢（服務端時間戳）。**絕不使用牌堆順序或我手上的牌面**。
 * AI 只能在這裡算好的候選（要牌／停牌）裡選；toView 不含牌堆，也不含未翻開的暗牌。
 */
import { randomInt } from "node:crypto";

export const BAR_BJ = {
  /** 超過多久沒動作的進行中局（我的回合），視為放棄（算輸） */
  staleMinutes: 30,
  /** Ivy 回合卡住多久（斷線／沒人催）就由服務端用兜底演算法替她打完，並按真實結果結算 */
  ivyStallSeconds: 45,
  /** 蒙特卡洛抽樣量（單次 <10 ms；有界） */
  samples: 1500,
  /** 我停牌「快／慢」的分界（秒）：用服務端時間戳，絕不信客戶端 */
  fastStandSeconds: 4,
  slowStandSeconds: 12,
} as const;

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Card = { r: Rank; s: Suit };

export type Rng = { int: (min: number, maxExclusive: number) => number; float: () => number };
export const cryptoRng: Rng = {
  int: (min, max) => randomInt(min, max),
  float: () => randomInt(0, 1_000_000) / 1_000_000,
};

export const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUITS: Suit[] = ["S", "H", "D", "C"];

export function fullDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
  return d;
}

/** Fisher–Yates，用注入的 rng（正式用 crypto） */
export function shuffle(cards: Card[], rng: Rng = cryptoRng): Card[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i + 1);
    [a[i], a[j]] = [a[j] as Card, a[i] as Card];
  }
  return a;
}

export function fmtCard(c: Card): string {
  const sym = { S: "♠", H: "♥", D: "♦", C: "♣" }[c.s];
  return `${c.r}${sym}`;
}

const cardValue = (r: Rank): number => (r === "A" ? 11 : r === "J" || r === "Q" || r === "K" || r === "10" ? 10 : Number(r));

/** 點數（A 取最有利的 1 或 11）；soft＝還有一張 A 算 11 */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

/** Blackjack＝恰好兩張且 21 點 */
export const isBlackjack = (cards: Card[]): boolean => cards.length === 2 && handValue(cards).total === 21;
export const isBust = (cards: Card[]): boolean => handValue(cards).total > 21;

// ───────────────────────── 狀態與流程 ─────────────────────────

export type BjPhase = "player" | "ivy" | "done";
export type BjOutcome = "win" | "lose" | "push";
export type BjReason = "bust" | "ivy_bust" | "blackjack" | "points" | "abandoned";

export type BjState = {
  v: 1;
  rev: number;
  /** 剩餘牌堆（只在服務端；toView 絕不輸出） */
  deck: Card[];
  me: Card[];
  /** ivy[0] 明牌，ivy[1] 暗牌（phase 為 player 時不得輸出） */
  ivy: Card[];
  phase: BjPhase;
  doubled: boolean;
  /** 開局時間（ms；服務端時鐘） */
  dealtAt: number;
  /** 我停牌（或加倍後自動停牌）的時間（ms）；沒停＝null */
  standAt: number | null;
  /** 這鋪結果（phase=done 才有） */
  result: { outcome: BjOutcome; reason: BjReason } | null;
};

export function newRound(rng: Rng = cryptoRng, now: number = Date.now(), preset?: Card[]): BjState {
  const deck = preset !== undefined ? preset.slice() : shuffle(fullDeck(), rng);
  // 發牌順序：我、Ivy 明、我、Ivy 暗
  const me1 = deck.shift() as Card;
  const iv1 = deck.shift() as Card;
  const me2 = deck.shift() as Card;
  const iv2 = deck.shift() as Card;
  const s: BjState = { v: 1, rev: 1, deck, me: [me1, me2], ivy: [iv1, iv2], phase: "player", doubled: false, dealtAt: now, standAt: null, result: null };
  // 我 Blackjack：直接翻開 Ivy 暗牌、結算（她最多是平）
  if (isBlackjack(s.me)) return finish({ ...s, standAt: now });
  return s;
}

function draw(deck: Card[]): { card: Card; deck: Card[] } {
  const card = deck[0];
  if (card === undefined) throw new Error("deck empty");
  return { card, deck: deck.slice(1) };
}

export function decide(me: Card[], ivy: Card[]): { outcome: BjOutcome; reason: BjReason } {
  const mv = handValue(me).total;
  const iv = handValue(ivy).total;
  if (mv > 21) return { outcome: "lose", reason: "bust" };
  if (iv > 21) return { outcome: "win", reason: "ivy_bust" };
  const mbj = isBlackjack(me);
  const ibj = isBlackjack(ivy);
  if (mbj && ibj) return { outcome: "push", reason: "blackjack" };
  if (mbj) return { outcome: "win", reason: "blackjack" };
  if (ibj) return { outcome: "lose", reason: "blackjack" };
  if (mv > iv) return { outcome: "win", reason: "points" };
  if (mv < iv) return { outcome: "lose", reason: "points" };
  return { outcome: "push", reason: "points" };
}

function finish(s: BjState): BjState {
  return { ...s, phase: "done", result: decide(s.me, s.ivy), rev: s.rev + 1 };
}

export type StepResult = { ok: true; state: BjState } | { ok: false; code: "wrong_phase" | "invalid_action"; message: string };

function toIvyTurn(s: BjState, now: number): BjState {
  // 我爆牌：Ivy 不再補牌，直接結算
  if (isBust(s.me)) return finish({ ...s, standAt: now });
  return { ...s, phase: "ivy", standAt: now, rev: s.rev + 1 };
}

export function applyPlayer(s: BjState, action: "hit" | "stand" | "double", now: number = Date.now()): StepResult {
  if (s.phase !== "player") return { ok: false, code: "wrong_phase", message: "現在不是你的回合。" };
  if (action === "stand") return { ok: true, state: toIvyTurn(s, now) };
  if (action === "double" && s.me.length !== 2) return { ok: false, code: "invalid_action", message: "加倍只限頭兩張牌。" };
  const { card, deck } = draw(s.deck);
  const me = [...s.me, card];
  const next: BjState = { ...s, deck, me, doubled: action === "double" ? true : s.doubled, rev: s.rev + 1 };
  // 加倍＝拿一張後自動停；爆牌、21 點也自動結束我的回合
  if (action === "double" || isBust(me) || handValue(me).total === 21) return { ok: true, state: toIvyTurn(next, now) };
  return { ok: true, state: next };
}

// ───────────────────────── Ivy 的決策 ─────────────────────────

export type IvyMoveKind = "hit" | "stand";
export type IvyCandidate = { move: IvyMoveKind; win: number; push: number; lose: number; bust: number };

/** 我停牌的快慢（用服務端時間戳分桶，絕不信客戶端） */
export function standSpeed(s: Pick<BjState, "dealtAt" | "standAt">): "fast" | "normal" | "slow" {
  if (s.standAt === null) return "normal";
  const sec = (s.standAt - s.dealtAt) / 1000;
  return sec < BAR_BJ.fastStandSeconds ? "fast" : sec > BAR_BJ.slowStandSeconds ? "slow" : "normal";
}

/**
 * 算 Ivy 這一步的候選。
 * - 明顯劣勢的動作不給：≥21 只能停；≤11 不可能爆，要牌必然不劣（不給 AI 選，`forced` 指出）。
 * - 對手（我）的手牌當成「未知」：從她看不到的牌（牌堆＋我的牌）裡，抽出和我張數一致、沒爆、且合理停牌（>11）的組合。
 *   **不使用我的實際牌面**；只用張數。
 */
export function ivyCandidates(s: BjState, rng: Rng = cryptoRng, samples: number = BAR_BJ.samples): { candidates: IvyCandidate[]; forced: IvyMoveKind | null } {
  const own = handValue(s.ivy);
  if (own.total >= 21) return { candidates: [{ move: "stand", win: 0, push: 0, lose: 0, bust: 0 }], forced: "stand" };
  // Ivy 看不到的牌：牌堆＋我的牌（對她來說我的牌是未知的）
  // 固定排序：抽樣只依賴「未知牌的集合」，不依賴牌堆順序（不洩露即將發出的牌）
  const unseen = [...s.deck, ...s.me].sort((a, b) => (a.s + a.r < b.s + b.r ? -1 : a.s + a.r > b.s + b.r ? 1 : 0));
  const myCount = s.me.length;
  const stats = { stand: { w: 0, p: 0, l: 0, b: 0, n: 0 }, hit: { w: 0, p: 0, l: 0, b: 0, n: 0 } };
  let tries = 0;
  while (stats.stand.n < samples && tries < samples * 20) {
    tries += 1;
    // 抽 myCount + 1 張：前 myCount 張當我的（假設的）手牌，最後一張是 Ivy 要牌會拿到的
    const pool = unseen.slice();
    const picked: Card[] = [];
    for (let i = 0; i < myCount + 1; i++) {
      const k = rng.int(0, pool.length);
      picked.push(pool.splice(k, 1)[0] as Card);
    }
    const hypoMe = picked.slice(0, myCount);
    const mv = handValue(hypoMe).total;
    if (mv > 21 || mv <= 11) continue; // 我停牌了：沒爆；合理停牌點數 >11
    const next = picked[myCount] as Card;
    // 停
    const sv = own.total;
    const sOut = sv > mv ? "w" : sv < mv ? "l" : "p";
    stats.stand[sOut] += 1;
    stats.stand.n += 1;
    // 要一張後停（一步前瞻）
    const hv = handValue([...s.ivy, next]).total;
    if (hv > 21) {
      stats.hit.l += 1;
      stats.hit.b += 1;
    } else {
      stats.hit[hv > mv ? "w" : hv < mv ? "l" : "p"] += 1;
    }
    stats.hit.n += 1;
  }
  const mk = (move: IvyMoveKind): IvyCandidate => {
    const st = stats[move];
    const n = st.n === 0 ? 1 : st.n;
    return { move, win: st.w / n, push: st.p / n, lose: st.l / n, bust: st.b / n };
  };
  if (own.total <= 11) return { candidates: [mk("hit")], forced: "hit" };
  return { candidates: [mk("hit"), mk("stand")], forced: null };
}

/** 機率演算法的選擇（AI 失敗／逾時／沒開時的兜底）：贏率＋0.5×平率 較高者；差距太小時偏保守（停牌） */
export function chooseByProbability(candidates: IvyCandidate[]): IvyMoveKind {
  const score = (c: IvyCandidate): number => c.win + 0.5 * c.push;
  const hit = candidates.find((c) => c.move === "hit");
  const stand = candidates.find((c) => c.move === "stand");
  if (hit === undefined) return "stand";
  if (stand === undefined) return "hit";
  return score(hit) > score(stand) + 0.02 ? "hit" : "stand";
}

/** Ivy 走一步：move＝hit 補一張；stand 結算。呼叫方負責先算候選（可由 AI 挑）。 */
export function applyIvy(s: BjState, move: IvyMoveKind): StepResult {
  if (s.phase !== "ivy") return { ok: false, code: "wrong_phase", message: "現在不是 Ivy 的回合。" };
  if (move === "stand") return { ok: true, state: finish(s) };
  const { card, deck } = draw(s.deck);
  const ivy = [...s.ivy, card];
  const next: BjState = { ...s, deck, ivy, rev: s.rev + 1 };
  // 爆牌或 21 點：她的回合結束
  if (handValue(ivy).total >= 21) return { ok: true, state: finish(next) };
  return { ok: true, state: next };
}

/** 兜底：不問 AI，用機率演算法把 Ivy 的回合打完（斷線／卡住時由 sweep 呼叫）。 */
export function autoFinishIvy(s: BjState, rng: Rng = cryptoRng): BjState {
  let cur = s;
  for (let guard = 0; guard < 12 && cur.phase === "ivy"; guard++) {
    const { candidates, forced } = ivyCandidates(cur, rng);
    const move = forced ?? chooseByProbability(candidates);
    const r = applyIvy(cur, move);
    if (!r.ok) break;
    cur = r.state;
  }
  return cur.phase === "ivy" ? finish(cur) : cur;
}

// ───────────────────────── 給客戶端的視圖 ─────────────────────────

export type CardView = { r: Rank; s: Suit };
export type BjView = {
  id: string;
  status: "active" | "won" | "lost" | "push" | "abandoned";
  rev: number;
  phase: BjPhase;
  /** 我的牌（我自己的牌，客戶端本來就看得到） */
  me: CardView[];
  /** Ivy 的牌：明牌永遠有；暗牌只在我的回合結束後（phase≠player）才出現；之前是 null */
  ivy: (CardView | null)[];
  ivy_count: number;
  me_total: number;
  /** Ivy 的點數只在暗牌翻開後才給（之前是 null） */
  ivy_total: number | null;
  can_double: boolean;
  doubled: boolean;
  result: { outcome: BjOutcome; reason: BjReason } | null;
};

export function toView(matchId: string, status: BjView["status"], s: BjState): BjView {
  const holeVisible = s.phase !== "player";
  const ivy: (CardView | null)[] = s.ivy.map((c, i) => (i === 1 && !holeVisible ? null : { r: c.r, s: c.s }));
  return {
    id: matchId,
    status,
    rev: s.rev,
    phase: s.phase,
    me: s.me.map((c) => ({ r: c.r, s: c.s })),
    ivy,
    ivy_count: s.ivy.length,
    me_total: handValue(s.me).total,
    ivy_total: holeVisible ? handValue(s.ivy).total : null,
    can_double: s.phase === "player" && s.me.length === 2,
    doubled: s.doubled,
    result: s.result,
  };
}

/** 結局狀態 → 資料庫 status */
export function statusFor(s: BjState): BjView["status"] {
  if (s.phase !== "done" || s.result === null) return "active";
  return s.result.outcome === "win" ? "won" : s.result.outcome === "lose" ? "lost" : "push";
}
