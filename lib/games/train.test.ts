import { describe, expect, it } from "vitest";

import {
  advanceTrain,
  answerTrain,
  catOf,
  createTrainState,
  leaveTrain,
  matchAnswer,
  normalizeAnswer,
  parseTrainRules,
  trainHeat,
  unusedCount,
  viewTrainFor,
  type TrainState,
} from "./train";
import { TRAIN_CATS } from "./trainWords";

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
const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
/** 不觸發事件的規則（讓輪轉可預測） */
const quiet = parseTrainRules({ events: false });

function mk(n = 4, rules = quiet, seed = 5, holder = "u0"): TrainState {
  const s = createTrainState(ids(n), rules, T0, seeded(seed), holder);
  if ("error" in s) throw new Error(s.error);
  return s;
}

/** 取當前題目的第 i 個答案文字 */
function ans(s: TrainState, i: number): string {
  return catOf(s.cat)!.items[i][0];
}

describe("parseTrainRules", () => {
  it("缺省＝茶記／港鐵／廣東歌手／雞尾酒、中等倒數、事件開", () => {
    expect(parseTrainRules(undefined)).toEqual({ packs: ["mtr", "cha", "can", "cock"], fuse: "mid", events: true });
  });
  it("非法值回落；去重", () => {
    expect(parseTrainRules({ packs: ["x"], fuse: "huge", events: "yes" })).toEqual({ packs: ["mtr", "cha", "can", "cock"], fuse: "mid", events: true });
    expect(parseTrainRules({ packs: ["film", "film", "dist"], fuse: "short", events: false })).toEqual({ packs: ["film", "dist"], fuse: "short", events: false });
  });
});

describe("題庫與比對", () => {
  it("每個題目都有答案、答案去重（避免同一題裡重複項）", () => {
    for (const c of TRAIN_CATS) {
      expect(c.items.length).toBeGreaterThan(5);
      const firsts = c.items.map((it) => normalizeAnswer(it[0], c));
      // 提示：港鐵綫內站名不應重複
      expect(new Set(firsts).size).toBe(firsts.length);
    }
  });
  it("站名題忽略結尾的站／綫／區；空白與大小寫不影響", () => {
    const tw = catOf("tw")!;
    expect(matchAnswer(tw, "旺角站")?.[0]).toBe("旺角");
    expect(matchAnswer(tw, " 旺 角 ")?.[0]).toBe("旺角");
    expect(matchAnswer(tw, "不存在")).toBeNull();
    expect(matchAnswer(tw, "")).toBeNull();
    const cock = catOf("cock")!;
    expect(matchAnswer(cock, "mojito")?.[0]).toBe("Mojito");
    expect(matchAnswer(cock, "莫吉托")?.[0]).toBe("Mojito"); // 中文別名
    expect(matchAnswer(cock, "old fashioned")?.[0]).toBe("Old Fashioned");
  });
});

describe("createTrainState", () => {
  it("人數不在 3–8 → error", () => {
    expect("error" in createTrainState(ids(2), quiet, T0)).toBe(true);
    expect("error" in createTrainState(ids(9), quiet, T0)).toBe(true);
  });
  it("倒數長度落在所選範圍內（秒），且指定的人先拿車", () => {
    for (const fuse of ["short", "mid", "long"] as const) {
      const s = mk(4, parseTrainRules({ fuse, events: false }), 11, "u2");
      const sec = (s.fuse_deadline_ms - T0) / 1000;
      const [lo, hi] = { short: [15, 30], mid: [25, 50], long: [40, 80] }[fuse];
      expect(sec).toBeGreaterThanOrEqual(lo);
      expect(sec).toBeLessThanOrEqual(hi);
      expect(s.holder).toBe("u2");
    }
  });
  it("只在所選題庫裡選題", () => {
    const s = createTrainState(ids(4), parseTrainRules({ packs: ["dist"] }), T0, seeded(1));
    if ("error" in s) throw new Error(s.error);
    expect(s.cat).toBe("dist");
  });
});

describe("答題與傳車", () => {
  it("答啱：記錄、傳給下一位、答案流有一筆", () => {
    const s = mk();
    const r = answerTrain(s, "u0", ans(s, 0), T0 + 2000, seeded(1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.holder).toBe("u1");
    expect(r.state.passes).toBe(1);
    expect(r.state.log).toHaveLength(1);
    expect(r.state.log[0]).toMatchObject({ by: "u0", text: ans(s, 0) });
    expect(s.holder).toBe("u0"); // 不改入參
  });

  it("不是你的回合／不在題庫／重複 → 都不傳車（倒數照走）", () => {
    const s = mk();
    expect(answerTrain(s, "u1", ans(s, 0), T0, seeded(1))).toEqual({ ok: false, reason: "not_your_turn" });
    expect(answerTrain(s, "u0", "完全唔相干嘅嘢", T0, seeded(1))).toEqual({ ok: false, reason: "not_in_bank" });
    const r = answerTrain(s, "u0", ans(s, 0), T0, seeded(1));
    if (!r.ok) throw new Error(r.reason);
    // 下一位答同一個 → 重複
    expect(answerTrain(r.state, "u1", ans(s, 0), T0, seeded(1))).toEqual({ ok: false, reason: "duplicate" });
    expect(r.state.fuse_deadline_ms).toBe(s.fuse_deadline_ms);
  });

  it("傳車按座位序輪轉，繞一圈回到第一位", () => {
    let s = mk(3);
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      seen.push(s.holder);
      const r = answerTrain(s, s.holder, ans(s, i), T0, seeded(1));
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(seen).toEqual(["u0", "u1", "u2", "u0"]);
  });

  it("結束後不能再答", () => {
    const s = advanceTrain(mk(), T0 + 999_000).state;
    expect(answerTrain(s, s.holder, ans(s, 0), T0, seeded(1))).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("題目答晒自動轉題；全部題目答晒立即爆", () => {
    // 只選十八區（18 個答案）一個題庫
    let s = createTrainState(ids(3), parseTrainRules({ packs: ["dist"], events: false }), T0, seeded(3), "u0") as TrainState;
    const cat = catOf("dist")!;
    for (let i = 0; i < cat.items.length; i += 1) {
      const r = answerTrain(s, s.holder, cat.items[i][0], T0 + 1000, seeded(1));
      if (!r.ok) throw new Error(`${i}:${r.reason}`);
      s = r.state;
    }
    expect(unusedCount(s, cat)).toBe(0);
    expect(s.fuse_deadline_ms).toBe(T0 + 1000); // 立即爆
    const over = advanceTrain(s, T0 + 1000);
    expect(over.state.phase).toBe("over");
    expect(over.state.loser).toBe(s.holder);
  });
});

describe("隨機事件（rng 可控）", () => {
  const events = parseTrainRules({ packs: ["mtr", "cha"], events: true });
  /** 先答 3 題（rng 恆為 0.99＝不觸發），第 4 題用指定 rng 觸發 */
  function reach(n = 5): TrainState {
    let s = mk(n, events);
    for (let i = 0; i < 3; i += 1) {
      const r = answerTrain(s, s.holder, ans(s, i), T0, () => 0.99);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    return s;
  }
  /** 依序餵數：先 0.1（觸發 <0.3），再選事件用的數 */
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[Math.min(i++, xs.length - 1)];
  };

  it("調頭：方向反轉，之後往回傳", () => {
    const s = reach();
    const holder = s.holder;
    const r = answerTrain(s, holder, ans(s, 3), T0, seq(0.1, 0));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.event?.id).toBe("rev");
    expect(r.state.dir).toBe(-1);
    expect(r.state.holder).toBe(s.order[(s.order.indexOf(holder) - 1 + s.order.length) % s.order.length]);
  });

  it("越站：跳過下一位", () => {
    const s = reach();
    const holder = s.holder;
    const r = answerTrain(s, holder, ans(s, 3), T0, seq(0.1, 0.34));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.event?.id).toBe("skip");
    const i = s.order.indexOf(holder);
    expect(r.state.event?.target).toBe(s.order[(i + 1) % s.order.length]);
    expect(r.state.holder).toBe(s.order[(i + 2) % s.order.length]);
  });

  it("趕車：剩餘時間縮成 60%", () => {
    const s = reach();
    const now = T0 + 10_000;
    const left = s.fuse_deadline_ms - now;
    const r = answerTrain(s, s.holder, ans(s, 3), now, seq(0.1, 0.5));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.event?.id).toBe("rush");
    expect(r.state.fuse_deadline_ms).toBe(now + left * 0.6);
  });

  it("轉線：換一個還有答案的題目", () => {
    const s = reach();
    const r = answerTrain(s, s.holder, ans(s, 3), T0, seq(0.1, 0.99));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.event?.id).toBe("xfer");
    expect(r.state.cat).not.toBe(s.cat);
  });

  it("前 2 題不觸發事件；事件關閉也不觸發", () => {
    let s = mk(4, events);
    const r1 = answerTrain(s, s.holder, ans(s, 0), T0, () => 0);
    if (!r1.ok) throw new Error(r1.reason);
    expect(r1.state.event).toBeNull();
    s = reach();
    const off = { ...s, rules: { ...s.rules, events: false } };
    const r2 = answerTrain(off, off.holder, ans(s, 3), T0, () => 0);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.state.event).toBeNull();
  });
});

describe("倒數（懶結算）", () => {
  it("沒到點不變；到點→拿著車的人輸、局結束", () => {
    const s = mk();
    expect(advanceTrain(s, s.fuse_deadline_ms - 1).changed).toBe(false);
    const r = advanceTrain(s, s.fuse_deadline_ms);
    expect(r.changed).toBe(true);
    expect(r.state.phase).toBe("over");
    expect(r.state.loser).toBe("u0");
    expect(advanceTrain(r.state, T0 + 9e9).changed).toBe(false);
  });
});

describe("視圖：不洩漏真實倒數", () => {
  it("回包裡沒有截止時間、總長、已用答案以外的秘密欄位", () => {
    const s = mk();
    const v = viewTrainFor(s, T0 + 5000);
    const json = JSON.stringify(v);
    // 秘密欄位名與數值都不在回包裡（房規的 `fuse` 只是 short／mid／long 檔位，不是秒數）
    expect(json).not.toContain("fuse_deadline_ms");
    expect(json).not.toContain("fuse_total_ms");
    expect(json).not.toContain("started_ms");
    expect(json).not.toContain(String(s.fuse_deadline_ms));
    expect(json).not.toContain(String(s.fuse_total_ms));
    expect(v.cat?.remaining).toBe(catOf(s.cat)!.items.length);
    expect(v.rules.fuse).toBe("mid"); // 規則（倒數長度檔位）是公開的，但真實秒數不是
  });
  it("熱度 0–4 隨時間上升，結束時 4；只是量化的緊張度", () => {
    const s = mk();
    const total = s.fuse_deadline_ms - s.started_ms;
    expect(trainHeat(s, T0)).toBe(0);
    expect(trainHeat(s, T0 + total * 0.5)).toBe(2);
    expect(trainHeat(s, T0 + total * 0.99)).toBe(4);
    expect(trainHeat(advanceTrain(s, s.fuse_deadline_ms).state, T0)).toBe(4);
  });
  it("答案流與事件按 seq 單調遞增；答案流附題庫顏色", () => {
    let s = mk(4);
    for (let i = 0; i < 3; i += 1) {
      const r = answerTrain(s, s.holder, ans(s, i), T0 + i, () => 0.99);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    const v = viewTrainFor(s, T0);
    expect(v.log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(v.log[0].color).toBe(catOf(v.log[0].cat)!.color);
  });
});

describe("離場", () => {
  it("拿著車的人離場 → 車交給下一位；仍在局中", () => {
    const s = mk(4);
    const { state, changed } = leaveTrain(s, "u0");
    expect(changed).toBe(true);
    expect(state.holder).toBe("u1");
    expect(state.order).toEqual(["u1", "u2", "u3"]);
    expect(state.phase).toBe("run");
  });
  it("別人離場：車不動；剩不到 2 人 → 結束且沒有輸家", () => {
    const s = mk(3);
    const a = leaveTrain(s, "u2");
    expect(a.state.holder).toBe("u0");
    expect(a.state.order).toEqual(["u0", "u1"]);
    const b = leaveTrain(a.state, "u1");
    expect(b.state.phase).toBe("over");
    expect(b.state.loser).toBeNull();
  });
  it("重複離場／已結束：不變", () => {
    const s = mk(4);
    const once = leaveTrain(s, "u3").state;
    expect(leaveTrain(once, "u3").changed).toBe(false);
    expect(leaveTrain(advanceTrain(s, s.fuse_deadline_ms).state, "u1").changed).toBe(false);
  });
});
