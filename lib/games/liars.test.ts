import { describe, expect, it } from "vitest";

import {
  LIARS_RULES_DEFAULT,
  ROOM_CODE_ALPHABET,
  countMatching,
  deriveOnesBroken,
  generateRoomCode,
  isValidBid,
  minAutoBid,
  nextTurn,
  parseRules,
  resolveChallenge,
  rollDice,
} from "./liars";

const R = LIARS_RULES_DEFAULT;

describe("parseRules (UR H.1)", () => {
  it("缺省全默认；非法回落", () => {
    expect(parseRules({})).toEqual(R);
    expect(parseRules(null)).toEqual(R);
    expect(parseRules({ turn_seconds: 99, min_open_qty: -5 })).toEqual({
      ...R,
      min_open_qty: 1,
    });
  });
  it("合法房规透过", () => {
    expect(
      parseRules({ min_open_qty: 4, ones_break: true, turn_seconds: 15 }),
    ).toEqual({ ...R, min_open_qty: 4, ones_break: true, turn_seconds: 15 });
  });
});

describe("isValidBid (UR H.1 交接 §五)", () => {
  it("开局 qty≥min_open_qty", () => {
    expect(isValidBid(null, { qty: 2, face: 3 }, R)).toEqual({ ok: true });
    expect(isValidBid(null, { qty: 1, face: 6 }, R)).toEqual({
      ok: false,
      reason: "开局数量至少 2",
    });
  });
  it("加注：量不减／同量点大", () => {
    const prev = { qty: 3, face: 4, zhai: false };
    expect(isValidBid(prev, { qty: 2, face: 6 }, R).ok).toBe(false);
    expect(isValidBid(prev, { qty: 3, face: 4 }, R).ok).toBe(false);
    expect(isValidBid(prev, { qty: 3, face: 5 }, R)).toEqual({ ok: true });
    expect(isValidBid(prev, { qty: 4, face: 1 }, R)).toEqual({ ok: true });
  });
  it("形状非法", () => {
    expect(isValidBid(null, { qty: 0, face: 3 }, R).ok).toBe(false);
    expect(isValidBid(null, { qty: 2, face: 7 }, R).ok).toBe(false);
  });
  it("齋房规关即拒；开后齋转飛 +2", () => {
    expect(isValidBid(null, { qty: 2, face: 3, zhai: true }, R).ok).toBe(false);
    const zhai = { ...R, zhai_enabled: true };
    const prev = { qty: 3, face: 4, zhai: true };
    expect(isValidBid(prev, { qty: 4, face: 2 }, zhai).ok).toBe(false);
    expect(isValidBid(prev, { qty: 5, face: 2 }, zhai)).toEqual({ ok: true });
  });
  it("最小自动叫骰合法", () => {
    expect(isValidBid(null, minAutoBid(R), R)).toEqual({ ok: true });
  });
});

describe("countMatching／resolveChallenge", () => {
  const dice = [1, 1, 3, 4, 6, 2, 2];
  it("1 百搭（默认）", () => {
    expect(countMatching(dice, { qty: 1, face: 3, zhai: false }, R)).toBe(3);
  });
  it("叫 1 只数 1；ones_break 触发后别家不再吃 1", () => {
    expect(countMatching(dice, { qty: 1, face: 1, zhai: false }, R)).toBe(2);
    const broken = { ...R, ones_break: true };
    expect(countMatching(dice, { qty: 1, face: 3, zhai: false }, broken, true)).toBe(1);
    expect(countMatching(dice, { qty: 1, face: 3, zhai: false }, broken, false)).toBe(3);
  });
  it("齋不吃 1", () => {
    const zhai = { ...R, zhai_enabled: true };
    expect(countMatching(dice, { qty: 1, face: 3, zhai: true }, zhai)).toBe(1);
  });
  it("deriveOnesBroken：变体关恒 false；开后有人叫 1 即 true", () => {
    expect(deriveOnesBroken([{ face: 1 }], R)).toBe(false);
    expect(deriveOnesBroken([{ face: 3 }], { ...R, ones_break: true })).toBe(false);
    expect(deriveOnesBroken([{ face: 3 }, { face: 1 }], { ...R, ones_break: true })).toBe(true);
  });
  it("实际≥叫数则质疑者输", () => {
    expect(resolveChallenge(dice, { qty: 3, face: 3, zhai: false }, R)).toEqual({
      counted: 3,
      bid_met: true,
    });
    expect(resolveChallenge(dice, { qty: 4, face: 3, zhai: false }, R).bid_met).toBe(false);
  });
});

describe("nextTurn", () => {
  it("顺位＋回绕＋不在列回首位＋空 null", () => {
    expect(nextTurn(["a", "b", "c"], "b")).toBe("c");
    expect(nextTurn(["a", "b", "c"], "c")).toBe("a");
    expect(nextTurn(["a", "b"], "zzz")).toBe("a");
    expect(nextTurn([], "a")).toBeNull();
  });
});

describe("rollDice／generateRoomCode", () => {
  it("范围 1-6＋非法抛错", () => {
    expect(rollDice(5, () => 3)).toEqual([3, 3, 3, 3, 3]);
    expect(() => rollDice(0)).toThrow(RangeError);
  });
  it("大样本近似均匀（6000 颗，各面 1/6±0.03）", () => {
    // 上限 50 颗／次（服务端单局至多 8 人×10 颗），分批摇足样本。
    const dice: number[] = [];
    for (let b = 0; b < 120; b += 1) {
      dice.push(...rollDice(50));
    }
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) cnt[d] += 1;
    for (let f = 1; f <= 6; f += 1) {
      expect(cnt[f] / 6000).toBeGreaterThan(1 / 6 - 0.03);
      expect(cnt[f] / 6000).toBeLessThan(1 / 6 + 0.03);
    }
  });
  it("6 位＋字符集避混淆", () => {
    const code = generateRoomCode(() => 0);
    expect(code).toBe("AAAAAA");
    for (const ch of ROOM_CODE_ALPHABET) {
      expect("OI01".includes(ch)).toBe(false);
    }
    // 24 字母（去 O／I／L，L 防与 1 混）＋8 数字（去 0／1）＝31。
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
  });
});
