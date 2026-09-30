import { describe, expect, it } from "vitest";

import { emptyDex, mergeDex, registerDraw } from "./dex";

describe("registerDraw (UR G1.1)", () => {
  it("新卡入庫＋保底清零＋記日期", () => {
    const s = registerDraw(emptyDex(), "heineken", true, "2026-09-30");
    expect(s.ownedIds).toEqual(["heineken"]);
    expect(s.dupCounts).toEqual({ heineken: 1 });
    expect(s.pityStreak).toBe(0);
    expect(s.lastDrawDate).toBe("2026-09-30");
  });
  it("重複累數＋保底續杯；空串不髒數據", () => {
    const s1 = registerDraw(emptyDex(), "heineken", true, "2026-09-30");
    const s2 = registerDraw(s1, "heineken", false, "2026-09-30");
    expect(s2.dupCounts).toEqual({ heineken: 2 });
    expect(s2.pityStreak).toBe(1);
    expect(registerDraw(s2, "", false, "2026-09-30")).toBe(s2);
  });
});

describe("mergeDex (UR G1.1 登錄認領)", () => {
  it("並集去重＋計數相加＋保底取大＋日期取新＋不動源", () => {
    const user = registerDraw(registerDraw(emptyDex(), "a", true, "2026-09-28"), "a", false, "2026-09-28");
    const anon = registerDraw(registerDraw(emptyDex(), "a", true, "2026-09-30"), "b", true, "2026-09-30");
    const m = mergeDex(user, anon);
    expect(m.ownedIds).toEqual(["a", "b"]);
    expect(m.dupCounts).toEqual({ a: 3, b: 1 });
    expect(m.pityStreak).toBe(1);
    expect(m.lastDrawDate).toBe("2026-09-30");
    expect(user.ownedIds).toEqual(["a"]);
  });
});
