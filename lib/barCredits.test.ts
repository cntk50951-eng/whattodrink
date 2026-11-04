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
    expect(BAR_CREDIT).toEqual({ dailyLimit: 15, winGrant: 3, lotDays: 7, winsCapPerDay: 5, balanceCap: 45 });
  });
});
