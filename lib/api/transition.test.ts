import { describe, expect, it } from "vitest";

import { classifyTransition, updatedRowCount } from "./transition";

describe("classifyTransition", () => {
  it("更新到列＝applied（不管現在讀到什麼狀態）", () => {
    expect(classifyTransition(1, null, "completed")).toBe("applied");
    expect(classifyTransition(2, "whatever", "completed")).toBe("applied");
  });

  it("沒更新到列但已是目標態＝already（冪等成功、不重複副作用）", () => {
    expect(classifyTransition(0, "completed", "completed")).toBe("already");
    expect(classifyTransition(0, "recalled", "recalled")).toBe("already");
  });

  it("沒更新到列且在別的終態＝conflict（不假裝成功）", () => {
    expect(classifyTransition(0, "recalled", "completed")).toBe("conflict");
    expect(classifyTransition(0, "completed", "recalled")).toBe("conflict");
    expect(classifyTransition(0, "accepted", "declined")).toBe("conflict");
  });

  it("讀不到現態（列被刪或讀取失敗）也是 conflict，寧可讓客戶端重整", () => {
    expect(classifyTransition(0, null, "completed")).toBe("conflict");
  });
});

describe("updatedRowCount", () => {
  it("只認陣列長度，其餘一律 0", () => {
    expect(updatedRowCount([{ id: "a" }])).toBe(1);
    expect(updatedRowCount([])).toBe(0);
    expect(updatedRowCount(null)).toBe(0);
    expect(updatedRowCount(undefined)).toBe(0);
    expect(updatedRowCount({ id: "a" })).toBe(0);
  });
});
