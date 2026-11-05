import { describe, expect, it } from "vitest";

import {
  applyBid,
  applyChallenge,
  BAR_DICE,
  BAR_DICE_RULES,
  clampDice,
  ivyDecide,
  ivyOptions,
  ivyTurnContext,
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
  return { v: 1, rev: 0, dice: 3, opener: "me", me: [2, 3, 5], ivy: [1, 4, 6], bid: null, turn: "me", winner: null, log: [], ...partial };
}

describe("probAtLeast", () => {
  it("邊界", () => {
    expect(probAtLeast(0, 5, 1 / 3)).toBe(1);
    expect(probAtLeast(6, 5, 1 / 3)).toBe(0);
    expect(probAtLeast(1, 1, 1 / 3)).toBeCloseTo(1 / 3, 9);
    expect(probAtLeast(2, 3, 0.5)).toBeCloseTo(0.5, 9);
  });
});

describe("開局：香港版（骰數固定、可自選 3–6）", () => {
  it("默認每人 5 粒；自選 3–6，越界夾住", () => {
    expect(newMatch(undefined, "me", seeded(1)).me).toHaveLength(5);
    expect(newMatch(3, "me", seeded(1)).ivy).toHaveLength(3);
    expect(clampDice(9)).toBe(BAR_DICE.maxDice);
    expect(clampDice(1)).toBe(BAR_DICE.minDice);
    expect(clampDice("x")).toBe(BAR_DICE.defaultDice);
    expect(clampDice(4.5)).toBe(BAR_DICE.defaultDice);
  });
  it("opener=me：用戶先叫；opener=ivy：開局時 Ivy 已經叫出第一手", () => {
    const a = newMatch(5, "me", seeded(2));
    expect(a.turn).toBe("me");
    expect(a.bid).toBeNull();
    const b = newMatch(5, "ivy", seeded(2));
    expect(b.turn).toBe("me");
    expect(b.bid?.by).toBe("ivy");
    expect(b.bid!.qty).toBeGreaterThanOrEqual(BAR_DICE.minOpenQty);
  });
  it("骰面都是 1–6", () => {
    const s = newMatch(6, "me", seeded(3));
    expect([...s.me, ...s.ivy].every((d) => d >= 1 && d <= 6)).toBe(true);
  });
});

describe("叫骰規則", () => {
  it("開叫不得低於 2；超過總骰數／點數越界／減量都非法", () => {
    const s = stateWith({});
    expect(applyBid(s, { qty: 1, face: 6 }, seeded(2)).ok).toBe(false);
    expect(applyBid(s, { qty: 7, face: 2 }, seeded(2)).ok).toBe(false);
    expect(applyBid(s, { qty: 2, face: 7 }, seeded(2)).ok).toBe(false);
    expect(applyBid(s, { qty: 2, face: 3 }, seeded(2)).ok).toBe(true);
  });
  it("不是你的回合／已結束不能動；不能開自己的叫骰", () => {
    expect(applyBid(stateWith({ turn: "ivy" }), { qty: 2, face: 2 }).ok).toBe(false);
    expect(applyBid(stateWith({ winner: "me" }), { qty: 2, face: 2 }).ok).toBe(false);
    expect(applyChallenge(stateWith({})).ok).toBe(false);
    expect(applyChallenge(stateWith({ bid: { qty: 2, face: 2, by: "me" } })).ok).toBe(false);
  });
  it("legalBids：加注＝數量更多，或同量點數更大", () => {
    const l = legalBids({ qty: 3, face: 4 }, 6, BAR_DICE_RULES);
    expect(l.some((b) => b.qty === 3 && b.face === 4)).toBe(false);
    expect(l.some((b) => b.qty === 3 && b.face === 5)).toBe(true);
    expect(l.some((b) => b.qty === 2 && b.face === 6)).toBe(false);
    expect(l.some((b) => b.qty === 4 && b.face === 1)).toBe(true);
  });
});

describe("開骰：一鋪定輸贏、骰數不變", () => {
  it("叫數成立（含百搭 1）→ 質疑者輸＝Ivy 贏；兩邊骰數都沒少", () => {
    // 全場：me [2,3,5]、ivy [1,4,6]；叫「兩個 2」→ 2 有 1 顆＋百搭 1 有 1 顆＝2 ≥ 2 → 成立
    const s = stateWith({ bid: { qty: 2, face: 2, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rev = r.reveals[0]!;
    expect(rev.counted).toBe(2);
    expect(rev.bid_met).toBe(true);
    expect(rev.loser).toBe("me");
    expect(r.state.winner).toBe("ivy");
    expect(r.state.me).toHaveLength(3);
    expect(r.state.ivy).toHaveLength(3);
    expect(rev.hands.ivy).toEqual([1, 4, 6]);
  });
  it("叫數不成立 → 叫骰者輸＝用戶贏", () => {
    const s = stateWith({ bid: { qty: 3, face: 6, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reveals[0]!.bid_met).toBe(false);
    expect(r.reveals[0]!.loser).toBe("ivy");
    expect(r.state.winner).toBe("me");
  });
  it("結束後不能再動作", () => {
    const s = stateWith({ bid: { qty: 3, face: 6, by: "ivy" }, turn: "me" });
    const r = applyChallenge(s);
    if (!r.ok) throw new Error("x");
    expect(applyBid(r.state, { qty: 4, face: 2 }).ok).toBe(false);
    expect(applyChallenge(r.state).ok).toBe(false);
  });
});

describe("視圖不洩漏 Ivy 的骰", () => {
  it("只有自己的骰與 Ivy 的骰數；帶每人骰數與贏家", () => {
    const v = toView("m1", "active", stateWith({ dice: 3 }));
    expect(v.my_dice).toEqual([2, 3, 5]);
    expect(v.ivy_dice_count).toBe(3);
    expect(v.rules.dice_per_player).toBe(3);
    expect(v.winner).toBeNull();
    expect("ivy" in v).toBe(false);
    expect(JSON.stringify(v)).not.toContain('"ivy":[');
  });
  it("can_challenge 只在輪到你且 Ivy 剛叫過時為真", () => {
    expect(toView("m", "active", stateWith({ bid: { qty: 2, face: 2, by: "ivy" } })).can_challenge).toBe(true);
    expect(toView("m", "active", stateWith({ bid: null })).can_challenge).toBe(false);
    expect(toView("m", "active", stateWith({ bid: { qty: 2, face: 2, by: "me" }, turn: "ivy" })).can_challenge).toBe(false);
  });
});

/** 模擬一鋪：用戶用 `human` 策略，Ivy 用服務端機器人 */
function playOne(seed: number, dice: number, opener: "me" | "ivy", human: (s: DiceState, rng: Rng) => "challenge" | Bid): { winner: "me" | "ivy"; steps: number } {
  const rng = seeded(seed);
  let s = newMatch(dice, opener, rng);
  let steps = 0;
  while (s.winner === null) {
    steps += 1;
    if (steps > 100) throw new Error("一鋪不收斂");
    const a = human(s, rng);
    const r = a === "challenge" ? applyChallenge(s) : applyBid(s, a, rng);
    if (!r.ok) throw new Error(`非法動作 ${JSON.stringify(a)} ${r.message}`);
    s = r.state;
  }
  return { winner: s.winner, steps };
}

/** 「普通玩家」：用同樣的機率估算，但門檻更隨性 */
function humanPolicy(threshold: number, jitter: number, bluff: number): (s: DiceState, rng: Rng) => "challenge" | Bid {
  return (s, rng) => {
    const prev = s.bid === null ? null : { qty: s.bid.qty, face: s.bid.face };
    const rules = { ...BAR_DICE_RULES, dice_per_player: s.dice };
    const m = ivyDecide(s.me, s.me.length + s.ivy.length, prev, rng, rules, { challengeThreshold: threshold, jitter, bluffChance: bluff });
    if (m.kind === "challenge" && prev !== null) return "challenge";
    if (m.kind === "bid") return m.bid;
    return legalBids(prev, s.me.length + s.ivy.length, rules)[0]!;
  };
}

describe("整鋪模擬", () => {
  it("每個骰數×先手組合都一定收斂、不會卡死（沒有『既不能叫也不能開』的局面）", () => {
    for (const dice of [3, 4, 5, 6]) {
      for (const opener of ["me", "ivy"] as const) {
        for (let i = 0; i < 400; i += 1) {
          const r = playOne(1000 + i, dice, opener, humanPolicy(0.3, 0.1, 0.15));
          expect(r.steps).toBeLessThan(40);
        }
      }
    }
  });
  it("同水平對手：用戶勝率在 40%–60%（沒有結構性偏向）；先手與後手各算", () => {
    for (const opener of ["me", "ivy"] as const) {
      let wins = 0;
      const N = 4000;
      for (let i = 0; i < N; i += 1) if (playOne(50_000 + i, 5, opener, humanPolicy(0.33, 0.07, 0.15)).winner === "me") wins += 1;
      const rate = wins / N;
      console.log(`[sim] 同水平對手（5 粒、${opener} 先叫）勝率 ${(rate * 100).toFixed(1)}%`);
      expect(rate).toBeGreaterThan(0.4);
      expect(rate).toBeLessThan(0.6);
    }
  });
  it("隨性玩家（亂開盅、亂唬）勝率低於 50%", () => {
    let wins = 0;
    const N = 3000;
    for (let i = 0; i < N; i += 1) if (playOne(90_000 + i, 5, i % 2 === 0 ? "me" : "ivy", humanPolicy(0.55, 0.2, 0.3)).winner === "me") wins += 1;
    console.log(`[sim] 隨性玩家勝率 ${((wins / N) * 100).toFixed(1)}%`);
    expect(wins / N).toBeLessThan(0.5);
  });
});

describe("F6 齋／飛（簡單版）", () => {
  const zhaiState = (p: Partial<DiceState> = {}): DiceState => stateWith({ zhai_on: true, ...p });

  it("關著時叫齋非法；開著時合法", () => {
    const off = applyBid(stateWith({}), { qty: 2, face: 3, zhai: true });
    expect(off.ok).toBe(false);
    const on = applyBid(zhaiState(), { qty: 2, face: 3, zhai: true }, seeded(1));
    expect(on.ok).toBe(true);
  });

  it("開盅計數：齋不算 1 百搭，飛算", () => {
    // 場上：me [1,3,3] ivy [3,4,6]；叫 4 個 3
    const base = { me: [1, 3, 3], ivy: [3, 4, 6] };
    const fly = applyBid(zhaiState({ ...base, turn: "me" }), { qty: 4, face: 3 }, { ...seeded(2), float: () => 0.99 });
    expect(fly.ok).toBe(true);
    // 直接驗 resolve：用 Ivy 叫、我開
    const ivyBid = zhaiState({ ...base, bid: { qty: 4, face: 3, by: "ivy" }, turn: "me" });
    const flyRes = applyChallenge(ivyBid);
    expect(flyRes.ok && flyRes.reveals[0]?.counted).toBe(4);      // 3 的三粒＋1 百搭
    const zhaiRes = applyChallenge(zhaiState({ ...base, bid: { qty: 4, face: 3, zhai: true, by: "ivy" }, turn: "me" }));
    expect(zhaiRes.ok && zhaiRes.reveals[0]?.counted).toBe(3);    // 齋：1 不算
    expect(zhaiRes.ok && zhaiRes.reveals[0]?.bid_met).toBe(false);
  });

  it("齋轉飛數量至少 +2；飛轉齋照一般加注", () => {
    const afterZhai = zhaiState({ bid: { qty: 3, face: 4, zhai: true, by: "ivy" }, turn: "me" });
    expect(applyBid(afterZhai, { qty: 4, face: 2 }).ok).toBe(false);
    expect(applyBid(afterZhai, { qty: 5, face: 1 }, seeded(3)).ok).toBe(true);
    const afterFly = zhaiState({ bid: { qty: 3, face: 4, by: "ivy" }, turn: "me" });
    expect(applyBid(afterFly, { qty: 3, face: 5, zhai: true }, seeded(4)).ok).toBe(true);
  });

  it("legalBids：開齋才有齋叫法，且不含叫 1 的齋", () => {
    const off = legalBids(null, 6, { ...BAR_DICE_RULES, zhai_enabled: false });
    expect(off.some((b) => b.zhai === true)).toBe(false);
    const on = legalBids(null, 6, { ...BAR_DICE_RULES, zhai_enabled: true });
    expect(on.some((b) => b.zhai === true)).toBe(true);
    expect(on.some((b) => b.zhai === true && b.face === 1)).toBe(false);
  });

  it("view 帶 zhai_enabled 與 bid.zhai", () => {
    const v = toView("m", "active", zhaiState({ bid: { qty: 2, face: 3, zhai: true, by: "me" } }));
    expect(v.rules.zhai_enabled).toBe(true);
    expect(v.bid?.zhai).toBe(true);
  });
});

describe("F5 候選與強制手", () => {
  it("ivyOptions：有上一手時第一個是開盅，叫法都合法，最多 1+3 個", () => {
    const opts = ivyOptions([2, 5, 5], 6, { qty: 3, face: 4 }, BAR_DICE_RULES);
    expect(opts[0]?.move.kind).toBe("challenge");
    expect(opts.length).toBeLessThanOrEqual(4);
    const legal = legalBids({ qty: 3, face: 4 }, 6, BAR_DICE_RULES);
    for (const o of opts.slice(1)) {
      expect(o.move.kind).toBe("bid");
      const m = o.move;
      if (m.kind === "bid") expect(legal.some((b) => b.qty === m.bid.qty && b.face === m.bid.face)).toBe(true);
    }
  });

  it("開局沒有上一手時沒有開盅候選", () => {
    const opts = ivyOptions([2, 5, 5], 6, null, BAR_DICE_RULES);
    expect(opts.every((o) => o.move.kind === "bid")).toBe(true);
  });

  it("forced 手被採用：強制開盅就當場結束", () => {
    const s = stateWith({ me: [2, 3, 5], ivy: [1, 4, 6] });
    const r = applyBid(s, { qty: 2, face: 6 }, seeded(5), { kind: "challenge" });
    expect(r.ok && r.reveals.length).toBe(1);
    expect(r.ok && r.state.winner).not.toBeNull();
  });

  it("ivyTurnContext：合法回上下文，非法回 null", () => {
    expect(ivyTurnContext(stateWith({}), { qty: 2, face: 3 })).not.toBeNull();
    expect(ivyTurnContext(stateWith({}), { qty: 1, face: 3 })).toBeNull();
  });
});
