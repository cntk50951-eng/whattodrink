import { describe, expect, it } from "vitest";

import { clearIpRateLimit, ipRateLimit } from "./rateLimit";

describe("ipRateLimit", () => {
  it("窗内 max 次过，第 max+1 次拒；滑窗过期恢复；key 隔离", () => {
    clearIpRateLimit();
    const NOW = 1_000_000;
    expect(ipRateLimit("a", NOW, 60_000, 2)).toEqual({ ok: true });
    expect(ipRateLimit("a", NOW + 1, 60_000, 2)).toEqual({ ok: true });
    expect(ipRateLimit("a", NOW + 2, 60_000, 2)).toEqual({ ok: false });
    expect(ipRateLimit("b", NOW + 2, 60_000, 2)).toEqual({ ok: true });
    expect(ipRateLimit("a", NOW + 60_001, 60_000, 2)).toEqual({ ok: true });
    clearIpRateLimit();
  });
});
