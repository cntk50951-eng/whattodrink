import { describe, expect, it } from "vitest";

import {
  applyBid,
  applyChallenge,
  BAR_DICE,
  BAR_DICE_RULES,
  ivyDecide,
  legalBids,
  newMatch,
  probAtLeast,
  toView,
  type Bid,
  type DiceState,
  type Rng,
} from "./barDice";

/** 確定性隨機（mulberry32） */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { float: next, int: (min, max) => min + Math.floor(next() * (max - min)) };
}

function stateWith(partial: Partial<DiceState>): DiceState {
  return { v: 1, rev: 0, round: 1, me: [2, 3, 5], ivy: [1, 4, 6], bid: null, turn: "me", winner: null, log: [], ...partial };
}

describe("probAtLeast", () => {
  it("邊界", () => {
    expect(probAtLeast(0, 5, 1 / 3)).toBe(1);
    expect(probAtLeast(6, 5, 1 / 3)).toBe(0);
    expect(probAtLeast(1, 1, 1 / 3)).toBeCloseTo(1 / 3, 9);
    expect(probAtLeast(2, 3, 0.5)).toBeCloseTo(0.5, 9);
  });
});

describe("開局與叫骰規則", () => {
  it("每人 3 粒、用戶先叫、骰面 1–6", () => {
    const s = newMatch(seeded(1));
    expect(s.me).toHaveLength(BAR_DICE.dicePerPlayer);
    expect(s.ivy).toHaveLength(BAR_DICE.dicePerPlayer);
    expect(s.turn).toBe("me");
    expect([...s.me, ...s.ivy].every((d) => d >= 1 && d <= 6)).toBe(true);
  });
  it("開局數量不得低於 2；超過總骰數非法；不能減量", () => {
    const s = stateWith({});
    expect(applyBid(s, { qty: 1, face: 6 }, seeded(2)).ok).toBe(false);
    expect(applyBid(s, { qty: 7, face: 2 }, seeded(2)).ok).toBe(false);
    expect(applyBid(s, { qty: 2, face: 7 }, seeded(2)).ok).toBe(false);
    const ok = applyBid(s, { qty: 2, face: 3 }, seeded(2));
    expect(ok.ok).toBe(true);
  });
  it("不是你的回合／已結束不能動", () => {
    expect(applyBid(stateWith({ turn: "ivy" }), { qty: 2, face: 2 }).ok).toBe(false);
    expect(applyBid(stateWith({ winner: "me" }), { qty: 2, face: 2 }).ok).toBe(false);
    expect(applyChallenge(stateWith({})).ok).toBe(false); // 沒有叫骰可質疑
    expect(applyChallenge(stateWith({ bid: { qty: 2, face: 2, by: "me" } })).ok).toBe(false); // 不能質疑自己
  });
  it("legalBids：加注＝數量更多，或同量點數更大", () => {
    const l = legalBids({ qty: 3, face: 4 }, 6, BAR_DICE_RULES);
    expect(l.some((b) => b.qty === 3 && b.face === 4)).toBe(false);
    expect(l.some((b) => b.qty === 3 && b.face === 5)).toBe(true);
    expect(l.some((b) => b.qty === 2 && b.face === 6)).toBe(false);
    expect(l.some((b) => b.qty === 4 && b.face === 1)).toBe(true);
  });
});

describe("質疑與結算", () => {
  it("叫數成立（含百搭 1）→ 質疑者輸；輸家少一粒", () => {
    // 全場 6 顆：me [2,3,5]、ivy [1,4,6]；叫「兩個 2」→ 2 的有 1 顆 ＋ 百搭 1 有 1 顆 ＝ 2 ≥ 2 → 成立
    const s = stateWith({ bid: { qty: 2, face: 2, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s, seeded(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rev = r.reveals[0]!;
    expect(rev.counted).toBe(2);
    expect(rev.bid_met).toBe(true);
    expect(rev.loser).toBe("me");
    expect(r.state.me).toHaveLength(2);
  });
  it("叫數不成立 → 叫骰者輸", () => {
    const s = stateWith({ bid: { qty: 3, face: 6, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s, seeded(4));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reveals[0]!.bid_met).toBe(false);
    expect(r.reveals[0]!.loser).toBe("ivy");
    expect(r.state.ivy).toHaveLength(2);
  });
  it("輸到 0 粒＝整局結束，對方是贏家", () => {
    const s = stateWith({ me: [4], ivy: [1, 2, 3], bid: { qty: 6, face: 6, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s, seeded(5));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reveals[0]!.loser).toBe("ivy");
    expect(r.state.ivy).toHaveLength(2);
    const s2 = stateWith({ me: [4], ivy: [1, 2, 3], bid: { qty: 2, face: 4, by: "ivy" }, turn: "me" });
    const r2 = applyChallenge(s2, seeded(5));
    if (!r2.ok) throw new Error("x");
    // 全場 4 的有 1 顆＋百搭 1 有 1 顆＝2 ≥ 2 → 成立 → 質疑者(me)輸，me 剩 0 → 結束
    expect(r2.state.winner).toBe("ivy");
    expect(r2.reveals.at(-1)!.loser_out).toBe(true);
  });
});

describe("視圖不洩漏 Ivy 的骰", () => {
  it("只有自己的骰與 Ivy 的骰數", () => {
    const v = toView("m1", "active", stateWith({}));
    expect(v.my_dice).toEqual([2, 3, 5]);
    expect(v.ivy_dice_count).toBe(3);
    expect(JSON.stringify(v)).not.toContain('"ivy":[');
    expect("ivy" in v).toBe(false);
  });
  it("can_challenge 只在輪到你且 Ivy 剛叫過時為真", () => {
    expect(toView("m", "active", stateWith({ bid: { qty: 2, face: 2, by: "ivy" } })).can_challenge).toBe(true);
    expect(toView("m", "active", stateWith({ bid: null })).can_challenge).toBe(false);
    expect(toView("m", "active", stateWith({ bid: { qty: 2, face: 2, by: "me" }, turn: "ivy" })).can_challenge).toBe(false);
  });
});

/** 模擬一整局：用戶用 `human` 策略，Ivy 用服務端機器人；回傳贏家與回合數。 */
function playOne(seed: number, human: (s: DiceState, rng: Rng) => "challenge" | Bid): { winner: "me" | "ivy"; rounds: number; steps: number } {
  const rng = seeded(seed);
  let s = newMatch(rng);
  let steps = 0;
  while (s.winner === null) {
    steps += 1;
    if (steps > 200) throw new Error("對局不收斂");
    const a = human(s, rng);
    const r = a === "challenge" ? applyChallenge(s, rng) : applyBid(s, a, rng);
    if (!r.ok) throw new Error(`非法動作 ${JSON.stringify(a)} ${r.message}`);
    s = r.state;
  }
  return { winner: s.winner, rounds: s.round, steps };
}

/** 一個「普通玩家」：用同樣的機率估算，但門檻更隨性（偏愛亂開盅／亂叫） */
function humanPolicy(threshold: number, jitter: number, bluff: number): (s: DiceState, rng: Rng) => "challenge" | Bid {
  return (s, rng) => {
    const prev = s.bid === null ? null : { qty: s.bid.qty, face: s.bid.face };
    const m = ivyDecide(s.me, s.me.length + s.ivy.length, prev, rng, BAR_DICE_RULES, { challengeThreshold: threshold, jitter, bluffChance: bluff });
    if (m.kind === "challenge" && prev !== null) return "challenge";
    if (m.kind === "bid") return m.bid;
    return legalBids(prev, s.me.length + s.ivy.length)[0]!;
  };
}

describe("整局模擬", () => {
  it("一定收斂、回合數合理（每人 3 粒，最多 5 回合）", () => {
    for (let i = 0; i < 300; i += 1) {
      const r = playOne(1000 + i, humanPolicy(0.3, 0.1, 0.15));
      expect(r.rounds).toBeGreaterThanOrEqual(3);
      expect(r.rounds).toBeLessThanOrEqual(5);
    }
  });
  it("對手和 Ivy 同水平時，雙方勝率都在 40%–60%（沒有結構性偏向）", () => {
    let wins = 0;
    const N = 3000;
    for (let i = 0; i < N; i += 1) {
      if (playOne(50_000 + i, humanPolicy(0.33, 0.07, 0.15)).winner === "me") wins += 1;
    }
    const rate = wins / N;
    console.log(`[sim] 同水平對手勝率 ${(rate * 100).toFixed(1)}%（目標：普通玩家約 45%）`);
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });
  it("隨性玩家（亂開盅、亂唬）勝率低於同水平玩家", () => {
    let wins = 0;
    const N = 2000;
    for (let i = 0; i < N; i += 1) {
      if (playOne(90_000 + i, humanPolicy(0.55, 0.2, 0.3)).winner === "me") wins += 1;
    }
    console.log(`[sim] 隨性玩家勝率 ${((wins / N) * 100).toFixed(1)}%`);
    expect(wins / N).toBeLessThan(0.5);
  });
});
