import { describe, expect, it } from "vitest";

import {
  applyIvy,
  applyPlayer,
  autoFinishIvy,
  chooseByProbability,
  decide,
  fullDeck,
  handValue,
  isBlackjack,
  ivyCandidates,
  newRound,
  shuffle,
  standSpeed,
  statusFor,
  toView,
  type BjState,
  type Card,
  type Rng,
  type Rank,
  type Suit,
} from "./barBlackjack";

const c = (r: Rank, s: Suit = "S"): Card => ({ r, s });
/** 可重現的 rng（LCG） */
function seeded(seed: number): Rng {
  let x = seed >>> 0;
  const next = () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
  return { int: (min, max) => min + Math.floor(next() * (max - min)), float: next };
}
/** 指定開頭幾張，後面補整副牌的剩餘 */
function stacked(top: Card[]): Card[] {
  const rest = fullDeck().filter((x) => !top.some((t) => t.r === x.r && t.s === x.s));
  return [...top, ...rest];
}

describe("點數", () => {
  it("A 軟／硬", () => {
    expect(handValue([c("A"), c("6")])).toEqual({ total: 17, soft: true });
    expect(handValue([c("A"), c("6"), c("10")])).toEqual({ total: 17, soft: false });
    expect(handValue([c("A"), c("A"), c("9")])).toEqual({ total: 21, soft: true });
    expect(handValue([c("K"), c("Q"), c("5")]).total).toBe(25);
  });
  it("Blackjack 只算兩張", () => {
    expect(isBlackjack([c("A"), c("K")])).toBe(true);
    expect(isBlackjack([c("7"), c("7"), c("7")])).toBe(false);
    expect(isBlackjack([c("A"), c("5"), c("5")])).toBe(false);
  });
});

describe("結算 decide", () => {
  it("爆牌／點數／Blackjack／平手", () => {
    expect(decide([c("K"), c("Q"), c("5")], [c("5"), c("5")])).toEqual({ outcome: "lose", reason: "bust" });
    expect(decide([c("10"), c("8")], [c("K"), c("Q"), c("5")])).toEqual({ outcome: "win", reason: "ivy_bust" });
    expect(decide([c("A"), c("K")], [c("A", "H"), c("Q")])).toEqual({ outcome: "push", reason: "blackjack" });
    expect(decide([c("A"), c("K")], [c("7"), c("7"), c("7")])).toEqual({ outcome: "win", reason: "blackjack" });
    expect(decide([c("7"), c("7"), c("7")], [c("A"), c("K")])).toEqual({ outcome: "lose", reason: "blackjack" });
    expect(decide([c("10"), c("9")], [c("10"), c("8")])).toEqual({ outcome: "win", reason: "points" });
    expect(decide([c("10"), c("8")], [c("10"), c("9")])).toEqual({ outcome: "lose", reason: "points" });
    expect(decide([c("10"), c("9")], [c("9", "H"), c("K")])).toEqual({ outcome: "push", reason: "points" });
  });
});

describe("洗牌與開局", () => {
  it("一副牌 52 張不重複，洗牌後仍是 52 張", () => {
    const d = shuffle(fullDeck(), seeded(1));
    expect(d).toHaveLength(52);
    expect(new Set(d.map((x) => x.r + x.s)).size).toBe(52);
  });
  it("發牌順序：我、Ivy 明、我、Ivy 暗；牌堆少 4 張", () => {
    const s = newRound(seeded(2), 1000, stacked([c("2"), c("3"), c("4"), c("5")]));
    expect(s.me).toEqual([c("2"), c("4")]);
    expect(s.ivy).toEqual([c("3"), c("5")]);
    expect(s.deck).toHaveLength(48);
    expect(s.phase).toBe("player");
  });
  it("我 Blackjack：立刻結算並翻開 Ivy 暗牌（Ivy 沒有＝贏；也有＝平）", () => {
    const win = newRound(seeded(3), 1000, stacked([c("A"), c("9"), c("K"), c("7")]));
    expect(win.phase).toBe("done");
    expect(win.result).toEqual({ outcome: "win", reason: "blackjack" });
    expect(toView("m", statusFor(win), win).ivy[1]).not.toBeNull();
    const push = newRound(seeded(3), 1000, stacked([c("A"), c("A", "H"), c("K"), c("Q")]));
    expect(push.result).toEqual({ outcome: "push", reason: "blackjack" });
    expect(statusFor(push)).toBe("push");
  });
});

describe("我的回合", () => {
  const deal = (top: Card[]): BjState => newRound(seeded(4), 1000, stacked(top));
  it("要牌：不爆就繼續、爆了就直接結算且 Ivy 不補牌", () => {
    const s = deal([c("10"), c("6"), c("6"), c("K"), c("K", "H")]);
    const r = applyPlayer(s, "hit", 2000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("done");
    expect(r.state.result).toEqual({ outcome: "lose", reason: "bust" });
    expect(r.state.ivy).toHaveLength(2);
    expect(statusFor(r.state)).toBe("lost");
  });
  it("要牌到 21 自動停牌進 Ivy 回合", () => {
    const s = deal([c("5"), c("9"), c("6"), c("K"), c("10")]);
    const r = applyPlayer(s, "hit", 2000);
    expect(r.ok && r.state.phase).toBe("ivy");
    expect(r.ok && r.state.standAt).toBe(2000);
  });
  it("加倍：只限頭兩張；拿剛好一張後自動停牌；doubled=true", () => {
    const s = deal([c("5"), c("9"), c("6"), c("K"), c("4")]);
    const r = applyPlayer(s, "double", 3000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me).toHaveLength(3);
    expect(r.state.doubled).toBe(true);
    expect(r.state.phase).toBe("ivy");
    // 三張後不能再加倍
    const s3 = applyPlayer(deal([c("2"), c("9"), c("3"), c("K"), c("2", "H")]), "hit", 1500);
    expect(s3.ok && s3.state.me.length).toBe(3);
    if (s3.ok) expect(applyPlayer(s3.state, "double").ok).toBe(false);
  });
  it("停牌記下服務端時間；非我的回合不能操作", () => {
    const s = deal([c("10"), c("9"), c("9", "H"), c("8"), c("2")]);
    const r = applyPlayer(s, "stand", 6000);
    expect(r.ok && r.state.phase).toBe("ivy");
    if (!r.ok) return;
    expect(standSpeed({ dealtAt: 1000, standAt: 6000 })).toBe("normal");
    expect(applyPlayer(r.state, "hit").ok).toBe(false);
  });
});

describe("Ivy 的決策", () => {
  const ivyTurn = (top: Card[]): BjState => {
    const s = newRound(seeded(5), 1000, stacked(top));
    const r = applyPlayer(s, "stand", 2000);
    if (!r.ok) throw new Error("setup");
    return r.state;
  };
  it("明顯的步：≥21 只能停、≤11 只能要（不給 AI 選）", () => {
    expect(ivyCandidates(ivyTurn([c("10"), c("10", "H"), c("9"), c("A", "H")]), seeded(1)).forced).toBe("stand"); // Ivy 21
    expect(ivyCandidates(ivyTurn([c("10"), c("2"), c("9"), c("5")]), seeded(1)).forced).toBe("hit"); // Ivy 7
    expect(ivyCandidates(ivyTurn([c("10"), c("10", "H"), c("9"), c("6")]), seeded(1)).forced).toBeNull(); // Ivy 16
  });
  it("邊界：候選只取決於張數與未知牌集合，不取決於我的實際牌面或牌堆順序", () => {
    const a = ivyTurn([c("K"), c("10", "H"), c("Q", "H"), c("6")]);
    // B：把我的兩張牌和牌堆最前面的兩張對調，並把牌堆順序倒過來；Ivy 的牌、我的張數不變
    const moved = a.deck.slice(0, 2);
    const b: BjState = { ...a, me: moved, deck: [...a.deck.slice(2), ...a.me].reverse() };
    expect(b.me.map((x) => x.r + x.s)).not.toEqual(a.me.map((x) => x.r + x.s));
    const ra = ivyCandidates(a, seeded(11), 800);
    const rb = ivyCandidates(b, seeded(11), 800);
    expect(ra).toEqual(rb);
  });
  it("機率合理：Ivy 16 對我停牌 2 張，要牌爆牌率高；Ivy 12 要牌爆牌率低", () => {
    const hi = ivyCandidates(ivyTurn([c("10"), c("10", "H"), c("9"), c("6")]), seeded(7), 1500).candidates.find((x) => x.move === "hit");
    const lo = ivyCandidates(ivyTurn([c("10"), c("10", "H"), c("9"), c("2")]), seeded(7), 1500).candidates.find((x) => x.move === "hit");
    expect(hi && lo && hi.bust > lo.bust).toBe(true);
    expect(hi?.win).toBeGreaterThanOrEqual(0);
  });
  it("兜底 chooseByProbability：差距小偏保守", () => {
    expect(chooseByProbability([{ move: "hit", win: 0.3, push: 0, lose: 0.7, bust: 0.5 }, { move: "stand", win: 0.29, push: 0, lose: 0.71, bust: 0 }])).toBe("stand");
    expect(chooseByProbability([{ move: "hit", win: 0.6, push: 0, lose: 0.4, bust: 0.1 }, { move: "stand", win: 0.2, push: 0, lose: 0.8, bust: 0 }])).toBe("hit");
  });
  it("逐步：applyIvy 要牌後可繼續；爆牌／21 結束並結算", () => {
    const s = ivyTurn([c("10"), c("10", "H"), c("9"), c("6"), c("K")]); // Ivy 16，下一張 K → 爆
    const r = applyIvy(s, "hit");
    expect(r.ok && r.state.phase).toBe("done");
    expect(r.ok && r.state.result).toEqual({ outcome: "win", reason: "ivy_bust" });
    const r2 = applyIvy(s, "stand");
    expect(r2.ok && r2.state.result).toEqual({ outcome: "win", reason: "points" }); // 我 19 > 16
  });
  it("autoFinishIvy 一定能把回合打完且結果自洽", () => {
    for (let i = 1; i <= 30; i++) {
      const s = newRound(seeded(i), 1000);
      if (s.phase !== "player") continue;
      const r = applyPlayer(s, "stand", 2000);
      if (!r.ok) throw new Error("setup");
      const done = autoFinishIvy(r.state, seeded(100 + i));
      expect(done.phase).toBe("done");
      expect(done.result).toEqual(decide(done.me, done.ivy));
    }
  });
});

describe("視圖不洩露", () => {
  it("我的回合：暗牌是 null、沒有牌堆、沒有 Ivy 點數", () => {
    const s = newRound(seeded(6), 1000, stacked([c("10"), c("3"), c("9"), c("8"), c("2")]));
    const v = toView("m1", "active", s);
    expect(v.ivy[0]).toEqual(c("3"));
    expect(v.ivy[1]).toBeNull();
    expect(v.ivy_total).toBeNull();
    expect(v.ivy_count).toBe(2);
    expect(v.can_double).toBe(true);
    const json = JSON.stringify(v);
    expect(json).not.toContain("deck");
    expect(json).not.toContain('"r":"8"'); // 暗牌 8 不在視圖裡
    expect(Object.keys(v)).not.toContain("deck");
  });
  it("Ivy 回合起暗牌翻開", () => {
    const s = newRound(seeded(6), 1000, stacked([c("10"), c("3"), c("9"), c("8"), c("2")]));
    const r = applyPlayer(s, "stand", 2000);
    if (!r.ok) throw new Error("setup");
    const v = toView("m1", "active", r.state);
    expect(v.ivy[1]).toEqual(c("8"));
    expect(v.ivy_total).toBe(11);
  });
});
