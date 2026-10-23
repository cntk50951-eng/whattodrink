import { describe, expect, it } from "vitest";

import {
  SPY_SECONDS,
  advanceSpy,
  aliveIds,
  canSendText,
  castVote,
  createSpyState,
  currentSpeaker,
  effectiveSpyCount,
  leaksOwnWord,
  leaveSpy,
  parseSpyRules,
  speakDone,
  viewSpyFor,
  type SpyState,
} from "./spy";
import { SPY_PACKS } from "./spyWords";

/** 可重現亂數（mulberry32） */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const T0 = 1_700_000_000_000;
const sec = (n: number) => n * 1000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, seat: i }));
const rules1 = parseSpyRules({});

function mk(n = 6, rules = rules1, seed = 7): SpyState {
  const s = createSpyState(ids(n), rules, T0, seeded(seed));
  if ("error" in s) throw new Error(s.error);
  return s;
}

/** 推到第一個 speak 階段 */
function toSpeak(s: SpyState): SpyState {
  return advanceSpy(s, T0 + sec(SPY_SECONDS.deal)).state;
}

describe("parseSpyRules／effectiveSpyCount", () => {
  it("缺省＝1 臥底＋全題庫；壞值回落", () => {
    expect(parseSpyRules(undefined)).toEqual({ spy_count: 1, packs: [...SPY_PACKS] });
    expect(parseSpyRules({ spy_count: 9, packs: ["x"] })).toEqual({ spy_count: 1, packs: [...SPY_PACKS] });
    expect(parseSpyRules({ spy_count: 2, packs: ["tea", "tea", "night"] })).toEqual({ spy_count: 2, packs: ["tea", "night"] });
  });
  it("兩位臥底要 7 人起", () => {
    const r = parseSpyRules({ spy_count: 2 });
    expect(effectiveSpyCount(r, 6)).toBe(1);
    expect(effectiveSpyCount(r, 7)).toBe(2);
  });
});

describe("createSpyState", () => {
  it("人數不在 4–8 → error", () => {
    expect("error" in createSpyState(ids(3), rules1, T0)).toBe(true);
    expect("error" in createSpyState(ids(9), rules1, T0)).toBe(true);
  });
  it("臥底拿臥底詞、平民拿同一個平民詞；臥底數正確", () => {
    const s = mk(8, parseSpyRules({ spy_count: 2 }));
    const spies = s.players.filter((p) => p.role === "spy");
    expect(spies).toHaveLength(2);
    expect(s.players.filter((p) => p.role === "civilian")).toHaveLength(6);
    expect(new Set(spies.map((p) => p.word))).toEqual(new Set([s.spy_word]));
    expect(new Set(s.players.filter((p) => p.role === "civilian").map((p) => p.word))).toEqual(new Set([s.civilian_word]));
    expect(s.civilian_word).not.toBe(s.spy_word);
    expect(s.phase).toBe("deal");
    expect(s.deadline_ms).toBe(T0 + sec(SPY_SECONDS.deal));
  });
  it("只在選中的題庫裡選詞", () => {
    const s = mk(5, parseSpyRules({ packs: ["hotpot"] }), 3);
    expect(["肥牛", "牛柏葉", "魚皮餃", "墨魚丸", "腐竹", "響鈴", "麻辣鍋底", "清湯鍋底"]).toContain(s.civilian_word);
  });
});

describe("viewSpyFor：按人裁剪，不洩密", () => {
  it("對局中：只看到自己的詞；別人的詞、全員身份、兩個詞都不在回包裡", () => {
    const s = toSpeak(mk(6));
    const spy = s.players.find((p) => p.role === "spy")!;
    const civ = s.players.find((p) => p.role === "civilian")!;
    const spyView = viewSpyFor(s, spy.id, T0);
    const civView = viewSpyFor(s, civ.id, T0);
    expect(spyView.me?.word).toBe(s.spy_word);
    expect(civView.me?.word).toBe(s.civilian_word);
    // 臥底的整份回包不含平民詞，平民的回包不含臥底詞
    expect(JSON.stringify(spyView)).not.toContain(s.civilian_word);
    expect(JSON.stringify(civView)).not.toContain(s.spy_word);
    // 存活者身份不公開（連自己也不知道）
    expect(spyView.me?.role).toBeNull();
    expect(spyView.players.every((p) => p.role === null)).toBe(true);
    expect(spyView.words).toBeNull();
    expect(JSON.stringify(spyView)).not.toContain('"role":"spy"');
  });

  it("結束後公開全員身份與兩個詞", () => {
    let s = toSpeak(mk(4));
    s = advanceSpy(s, T0 + sec(5000)).state; // 往後推很久，讓各階段走完（沒人投票）
    // 沒人投票永遠不會結束 → 手動讓臥底被投出
    s = toSpeak(mk(4));
    const spy = s.players.find((p) => p.role === "spy")!;
    s = advanceSpy(s, s.deadline_ms! + sec(60 * 5)).state; // 到 discuss 之後
    // 直接構造 vote 階段
    const v = { ...s, phase: "vote" as const, votes: {}, deadline_ms: T0 + sec(9999) };
    let cur: SpyState = v;
    for (const p of v.players.filter((x) => x.id !== spy.id)) {
      const r = castVote(cur, p.id, spy.id, T0);
      expect(r.ok).toBe(true);
      if (r.ok) cur = r.state;
    }
    const r = castVote(cur, spy.id, v.players.find((x) => x.id !== spy.id)!.id, T0);
    expect(r.ok).toBe(true);
    if (r.ok) cur = r.state;
    expect(cur.phase).toBe("over");
    expect(cur.winner).toBe("civilians");
    const view = viewSpyFor(cur, "u0", T0);
    expect(view.words).toEqual({ civilian: cur.civilian_word, spy: cur.spy_word });
    expect(view.players.find((p) => p.id === spy.id)?.role).toBe("spy");
    expect(view.deadline).toBeNull();
  });

  it("投票中只看到已投人數與自己的票，看不到別人投誰", () => {
    let s = toSpeak(mk(5));
    s = { ...s, phase: "vote", votes: {}, deadline_ms: T0 + sec(999) };
    const r1 = castVote(s, "u0", "u1", T0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const other = viewSpyFor(r1.state, "u2", T0);
    expect(other.votes_in).toBe(1);
    expect(other.me?.my_vote).toBeNull();
    expect(other.last_result).toBeNull();
    expect(viewSpyFor(r1.state, "u0", T0).me?.my_vote).toBe("u1");
  });
});

describe("時間軸（懶結算）", () => {
  it("deal → 第一位 speak（60 秒）→ 逐人 → discuss(45) → vote(30) → result(8) → 第 2 輪", () => {
    let s = mk(4);
    expect(s.phase).toBe("deal");
    let t = T0 + sec(SPY_SECONDS.deal);
    s = advanceSpy(s, t).state;
    expect(s.phase).toBe("speak");
    expect(s.order).toHaveLength(4);
    expect(s.deadline_ms).toBe(t + sec(SPY_SECONDS.speak));
    for (let i = 1; i < 4; i += 1) {
      t += sec(SPY_SECONDS.speak);
      s = advanceSpy(s, t).state;
      expect(s.speak_index).toBe(i);
      expect(s.phase).toBe("speak");
    }
    t += sec(SPY_SECONDS.speak);
    s = advanceSpy(s, t).state;
    expect(s.phase).toBe("discuss");
    t += sec(SPY_SECONDS.discuss);
    s = advanceSpy(s, t).state;
    expect(s.phase).toBe("vote");
    t += sec(SPY_SECONDS.vote);
    s = advanceSpy(s, t).state;
    expect(s.phase).toBe("result"); // 沒人投票→沒人出局
    expect(s.last_result?.eliminated).toBeNull();
    t += sec(SPY_SECONDS.result);
    s = advanceSpy(s, t).state;
    expect(s.phase).toBe("speak");
    expect(s.round).toBe(2);
  });

  it("沒到點不變、回原物件；久沒輪詢從舊截止時間起算，不多給時間", () => {
    const s = mk(4);
    expect(advanceSpy(s, T0).changed).toBe(false);
    expect(advanceSpy(s, T0).state).toBe(s);
    // 一口氣過了：看詞 12 + 發言 4×60 + 討論 45 = 297 秒 → 剛好進入 vote，截止 = 297+30
    const late = advanceSpy(s, T0 + sec(298));
    expect(late.changed).toBe(true);
    expect(late.state.phase).toBe("vote");
    expect(late.state.deadline_ms).toBe(T0 + sec(12 + 4 * 60 + 45 + 30));
  });

  it("輪到誰：每輪第一位輪流換", () => {
    const a = toSpeak(mk(5));
    const nextRound = (s: SpyState) => {
      const x = { ...s, phase: "result" as const, deadline_ms: T0 };
      return advanceSpy(x, T0 + 1).state;
    };
    const b = nextRound(a);
    expect(b.order[0]).not.toBe(a.order[0]);
  });
});

describe("發言：每人 60 秒，可提前結束", () => {
  it("只有當前發言者能結束；結束後下一位從當下起算新的 60 秒", () => {
    const s = toSpeak(mk(4));
    const first = currentSpeaker(s)!;
    const other = s.order[1];
    expect(speakDone(s, other, T0 + sec(20))).toEqual({ ok: false, reason: "not_your_turn" });
    const r = speakDone(s, first, T0 + sec(20));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(currentSpeaker(r.state)).toBe(other);
    expect(r.state.deadline_ms).toBe(T0 + sec(20) + sec(SPY_SECONDS.speak));
  });
  it("最後一位說完→討論；非 speak 階段回 wrong_phase", () => {
    let s = toSpeak(mk(4));
    for (let i = 0; i < 4; i += 1) {
      const r = speakDone(s, currentSpeaker(s)!, T0 + sec(30));
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(s.phase).toBe("discuss");
    expect(speakDone(s, "u0", T0)).toEqual({ ok: false, reason: "wrong_phase" });
  });
});

describe("投票與勝負", () => {
  const voting = (n: number): SpyState => ({ ...toSpeak(mk(n)), phase: "vote", votes: {}, deadline_ms: T0 + sec(999) });

  it("不能投自己／已出局者／重複投", () => {
    const s = voting(5);
    expect(castVote(s, "u0", "u0", T0)).toEqual({ ok: false, reason: "invalid_target" });
    expect(castVote(s, "u0", "ghost", T0)).toEqual({ ok: false, reason: "invalid_target" });
    const r = castVote(s, "u0", "u1", T0);
    if (!r.ok) throw new Error("should ok");
    expect(castVote(r.state, "u0", "u2", T0)).toEqual({ ok: false, reason: "already_voted" });
    expect(castVote({ ...s, phase: "speak" }, "u0", "u1", T0)).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("平票沒人出局，進 result", () => {
    let s = voting(4);
    const pairs: Array<[string, string]> = [["u0", "u1"], ["u1", "u0"], ["u2", "u3"], ["u3", "u2"]];
    for (const [v, t] of pairs) {
      const r = castVote(s, v, t, T0);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(s.phase).toBe("result");
    expect(s.last_result?.eliminated).toBeNull();
    expect(aliveIds(s)).toHaveLength(4);
  });

  it("投出平民後臥底數追平平民數 → 臥底贏", () => {
    // 4 人 1 臥底：投出一個平民 → 剩 2 平民 1 臥底（沒贏）；再投出一個 → 1:1 臥底贏
    let s = voting(4);
    const spy = s.players.find((p) => p.role === "spy")!;
    const civs = s.players.filter((p) => p.role === "civilian");
    const cast = (st: SpyState, target: string) => {
      let cur = st;
      for (const p of aliveIds(cur)) {
        if (p === target) continue;
        const r = castVote(cur, p, target, T0);
        if (!r.ok) throw new Error(r.reason);
        cur = r.state;
      }
      // 被投者自己投給別人
      const other = aliveIds(cur).find((x) => x !== target)!;
      const r = castVote(cur, target, other, T0);
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };
    s = cast(s, civs[0].id);
    expect(s.phase).toBe("result");
    expect(s.winner).toBeNull();
    s = { ...s, phase: "vote", votes: {}, deadline_ms: T0 + sec(999) };
    s = cast(s, civs[1].id);
    expect(s.phase).toBe("over");
    expect(s.winner).toBe("spies");
    expect(s.players.find((p) => p.id === spy.id)?.alive).toBe(true);
  });

  it("出局者的身份在 result 就公開（仍不洩漏其他存活者）", () => {
    let s = voting(5);
    const target = s.players.find((p) => p.role === "civilian")!.id;
    for (const p of aliveIds(s)) {
      if (p === target) continue;
      const r = castVote(s, p, target, T0);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    const other = aliveIds(s).find((x) => x !== target)!;
    const last = castVote(s, target, other, T0);
    if (!last.ok) throw new Error(last.reason);
    const view = viewSpyFor(last.state, "u0", T0);
    expect(view.players.find((p) => p.id === target)?.role).toBe("civilian");
    expect(view.players.filter((p) => p.alive).every((p) => p.role === null)).toBe(true);
    expect(view.last_result?.eliminated).toBe(target);
  });
});

describe("離場", () => {
  it("輪到他發言時離場 → 換下一位；他視為出局", () => {
    const s = toSpeak(mk(6));
    const speaker = currentSpeaker(s)!;
    const { state, changed } = leaveSpy(s, speaker, T0 + sec(5));
    expect(changed).toBe(true);
    expect(state.players.find((p) => p.id === speaker)?.alive).toBe(false);
    expect(currentSpeaker(state)).toBe(s.order[1]);
    expect(state.deadline_ms).toBe(T0 + sec(5) + sec(SPY_SECONDS.speak));
  });

  it("臥底離場 → 平民贏；平民離到追平 → 臥底贏", () => {
    const s = toSpeak(mk(5));
    const spy = s.players.find((p) => p.role === "spy")!;
    const a = leaveSpy(s, spy.id, T0);
    expect(a.state.phase).toBe("over");
    expect(a.state.winner).toBe("civilians");
    let cur = s;
    for (const c of s.players.filter((p) => p.role === "civilian").slice(0, 3)) {
      cur = leaveSpy(cur, c.id, T0).state;
    }
    expect(cur.winner).toBe("spies");
  });

  it("投票中離場：清掉他的票，並在其他人都投完時開票", () => {
    let s: SpyState = { ...toSpeak(mk(5)), phase: "vote", votes: {}, deadline_ms: T0 + sec(999) };
    for (const p of ["u0", "u1", "u2"]) {
      const r = castVote(s, p, "u3", T0);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(s.phase).toBe("vote");
    const left = leaveSpy(s, "u4", T0).state; // u4 沒投票，離場後剩 u3 未投
    expect(left.phase).toBe("vote");
    const r = castVote(left, "u3", "u0", T0);
    expect(r.ok && r.state.phase !== "vote").toBe(true);
  });

  it("重複離場／已結束：不變", () => {
    const s = toSpeak(mk(5));
    const once = leaveSpy(s, "u0", T0).state;
    expect(leaveSpy(once, "u0", T0).changed).toBe(false);
    expect(leaveSpy({ ...s, phase: "over" }, "u0", T0).changed).toBe(false);
  });
});

describe("發言權限與防洩詞", () => {
  it("speak 只有當前發言者能發文字；討論人人可；vote／出局者只能快捷語", () => {
    const s = toSpeak(mk(5));
    const sp = currentSpeaker(s)!;
    const other = s.order.find((x) => x !== sp)!;
    expect(canSendText(s, sp).ok).toBe(true);
    expect(canSendText(s, other).ok).toBe(false);
    expect(canSendText({ ...s, phase: "discuss" }, other).ok).toBe(true);
    expect(canSendText({ ...s, phase: "vote" }, other).ok).toBe(false);
    expect(canSendText({ ...s, phase: "deal" }, other).ok).toBe(false);
    // 離場的必須是平民（臥底離場會直接結束局面，結束後人人可發言）
    const civ = s.players.find((p) => p.role === "civilian" && p.id !== sp)!.id;
    const dead = leaveSpy({ ...s, phase: "discuss" }, civ, T0).state;
    expect(dead.phase).toBe("discuss");
    expect(canSendText(dead, civ).ok).toBe(false);
    expect(canSendText({ ...s, phase: "over" }, other).ok).toBe(true);
  });

  it("擋住直接說出自己的詞（忽略空格／標點／大小寫）", () => {
    const s = toSpeak(mk(5));
    const p = s.players[0];
    expect(leaksOwnWord(s, p.id, `我哋食${p.word}`)).toBe(true);
    expect(leaksOwnWord(s, p.id, p.word.split("").join(" "))).toBe(true);
    expect(leaksOwnWord(s, p.id, "好食，有啲甜")).toBe(false);
    expect(leaksOwnWord(s, "nobody", p.word)).toBe(false);
  });
});
