import { describe, expect, it } from "vitest";

import { BAR_CREDIT, normalizeRequestId, parseBarCredits } from "./barCredits";

const good = {
  daily: { limit: 15, used: 3, remaining: 12 },
  lots: [{ id: "a", amount: 3, remaining: 2, expires_at: "2026-11-09T02:00:00Z" }],
  earned_total: 2,
  total: 14,
  wins_today: 1,
  next_reset_at: "2026-11-02T16:00:00Z",
};

describe("parseBarCredits", () => {
  it("接受完整形狀", () => {
    expect(parseBarCredits(good)).toEqual(good);
  });
  it("壞回包一律 null（呼叫方當故障，絕不放行免費聊天）", () => {
    expect(parseBarCredits(null)).toBeNull();
    expect(parseBarCredits({})).toBeNull();
    expect(parseBarCredits({ ...good, total: "14" })).toBeNull();
    expect(parseBarCredits({ ...good, lots: [{ id: 1 }] })).toBeNull();
    expect(parseBarCredits({ ...good, next_reset_at: 5 })).toBeNull();
  });
});

describe("normalizeRequestId", () => {
  it("安全字元的 ID 原樣用（冪等）", () => {
    expect(normalizeRequestId("req_12345678-abc")).toBe("req_12345678-abc");
  });
  it("不合法的（太短／含空白／非字串）改由服務端生成", () => {
    for (const bad of ["short", "has space 12345", "", 123, null, undefined, "x".repeat(65)]) {
      const id = normalizeRequestId(bad);
      expect(id).not.toBe(bad);
      expect(id.length).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("BAR_CREDIT 常量", () => {
  it("和設計稿一致", () => {
    expect(BAR_CREDIT).toEqual({ dailyLimit: 0, starterGrant: 50, winGrant: 3, lotDays: 7, winsCapPerDay: 5, postGrant: 5, postsCapPerDay: 10, balanceCap: 45 });
  });
});

describe("grantPostCredit", () => {
  const credits = { daily: { limit: 15, used: 0, remaining: 15 }, lots: [], earned_total: 1, total: 16, wins_today: 0, next_reset_at: "2026-11-08T00:00:00Z" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fake = (res: { data: unknown; error: { message: string } | null }): any => ({ rpc: async () => res });

  it("入帳成功：granted=1，reason=null", async () => {
    const { grantPostCredit } = await import("./barCredits");
    const r = await grantPostCredit(fake({ data: { granted: 1, reason: "ok", credits }, error: null }), "u", "p");
    expect(r?.granted).toBe(1);
    expect(r?.reason).toBeNull();
  });
  it("達日上限：granted=0 帶原因", async () => {
    const { grantPostCredit } = await import("./barCredits");
    const r = await grantPostCredit(fake({ data: { granted: 0, reason: "daily_cap", credits }, error: null }), "u", "p");
    expect(r).toMatchObject({ granted: 0, reason: "daily_cap" });
  });
  it("RPC 出錯回 null（不影響發帖）", async () => {
    const { grantPostCredit } = await import("./barCredits");
    expect(await grantPostCredit(fake({ data: null, error: { message: "boom" } }), "u", "p")).toBeNull();
  });
});

describe("ensureStarterCredit", () => {
  it("只對同一用戶打一次 RPC（進程內快取），失敗不快取", async () => {
    const { ensureStarterCredit } = await import("./barCredits");
    let calls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok: any = { rpc: async () => { calls += 1; return { data: true, error: null }; } };
    await ensureStarterCredit(ok, "u-ok"); await ensureStarterCredit(ok, "u-ok");
    expect(calls).toBe(1);
    let bad = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fail: any = { rpc: async () => { bad += 1; return { data: null, error: { message: "x" } }; } };
    await ensureStarterCredit(fail, "u-bad"); await ensureStarterCredit(fail, "u-bad");
    expect(bad).toBe(2);
  });
});
