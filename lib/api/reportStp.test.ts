import { describe, expect, it } from "vitest";

import { reportTrustDelta, reportTrustExpireDays, reportTrustKind } from "./reportStp";

describe("reportStp trust scoring helpers", () => {
  it("deducts -6 for upheld post reports with 90d expiry", () => {
    expect(reportTrustDelta("post", "inappropriate")).toBe(-6);
    expect(reportTrustDelta("post", "other")).toBe(-6);
    expect(reportTrustKind("post")).toBe("post_report_upheld");
    expect(reportTrustExpireDays("post")).toBe(90);
  });

  it("deducts -10 for severe user/message reports and -6 for other", () => {
    expect(reportTrustDelta("user", "harassment")).toBe(-10);
    expect(reportTrustDelta("user", "underage")).toBe(-10);
    expect(reportTrustDelta("message", "spam")).toBe(-10);
    expect(reportTrustDelta("user", "other")).toBe(-6);
    expect(reportTrustDelta("user", null)).toBe(-6);
    expect(reportTrustKind("user")).toBe("user_report_upheld");
    expect(reportTrustExpireDays("user")).toBe(180);
  });
});
