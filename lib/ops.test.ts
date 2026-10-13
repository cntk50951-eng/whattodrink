import { describe, expect, it } from "vitest";

import { isFreshMfa, mfaRequired, stepUpWindowMs } from "./ops";
import { safeOpsNext } from "./opsPage";

describe("isFreshMfa（step-up）", () => {
  const now = 1_800_000_000_000;
  const win = 15 * 60_000;
  it("最近 TOTP 在窗口內才算新鮮", () => {
    expect(isFreshMfa({ amr: [{ method: "totp", timestamp: now / 1000 - 60 }] }, now, win)).toBe(true);
    expect(isFreshMfa({ amr: [{ method: "totp", timestamp: now / 1000 - 15 * 60 }] }, now, win)).toBe(true);
    expect(isFreshMfa({ amr: [{ method: "totp", timestamp: now / 1000 - 15 * 60 - 1 }] }, now, win)).toBe(false);
  });
  it("密碼／OTP 郵件不算；取最近一次；缺失／亂格式一律 false", () => {
    expect(isFreshMfa({ amr: [{ method: "password", timestamp: now / 1000 }] }, now, win)).toBe(false);
    expect(
      isFreshMfa({ amr: [{ method: "totp", timestamp: now / 1000 - 99999 }, { method: "totp", timestamp: now / 1000 - 5 }] }, now, win),
    ).toBe(true);
    expect(isFreshMfa(null, now, win)).toBe(false);
    expect(isFreshMfa({ amr: "x" }, now, win)).toBe(false);
    expect(isFreshMfa({ amr: [{ method: "totp", timestamp: "now" }] }, now, win)).toBe(false);
  });
});

describe("配置", () => {
  it("MFA 默認必須，只有明確 false 才關", () => {
    expect(mfaRequired(undefined)).toBe(true);
    expect(mfaRequired("")).toBe(true);
    expect(mfaRequired("0")).toBe(true);
    expect(mfaRequired("false")).toBe(false);
  });
  it("step-up 窗口默認 15 分，越界回默認", () => {
    expect(stepUpWindowMs(undefined)).toBe(15 * 60_000);
    expect(stepUpWindowMs("5")).toBe(5 * 60_000);
    expect(stepUpWindowMs("0")).toBe(15 * 60_000);
    expect(stepUpWindowMs("9999")).toBe(15 * 60_000);
  });
  it("next 只放行 /innerharbour/ 站內路徑", () => {
    expect(safeOpsNext("/innerharbour/review/abc")).toBe("/innerharbour/review/abc");
    for (const bad of ["https://evil.test", "//evil.test", "/innerharbour//evil", "/other", "/innerharbour/..\\x", undefined]) {
      expect(safeOpsNext(bad)).toBe("/innerharbour/review");
    }
  });
});
