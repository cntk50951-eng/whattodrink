import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ service: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: mocks.service }));
vi.mock("@/lib/push/outbox", () => ({ dispatchNativePush: mocks.dispatch }));
vi.mock("@/lib/push/outboxPolicy", () => import("../../../../lib/push/outboxPolicy"));
import { POST } from "./route";

const shared = "unit-test-shared-cron-secret";
const dedicated = "unit-test-dedicated-push-secret";
const summary = { claimed: 0, sent: 0, skipped: 0, retry: 0, failed: 0 };
const request = (secret?: string): Request => new Request("https://example.invalid/api/internal/push-dispatch", {
  method: "POST", headers: secret === undefined ? {} : { Authorization: "Bearer " + secret },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", undefined);
  vi.stubEnv("PUSH_DISPATCH_SECRET", undefined);
  mocks.service.mockResolvedValue({ database: "unit-test" });
  mocks.dispatch.mockResolvedValue(summary);
});
afterEach(() => vi.unstubAllEnvs());

describe("push dispatcher credential isolation", () => {
  it("rejects unconfigured callers before touching the database", async () => {
    expect((await POST(request())).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("preserves shared Cron compatibility when no dedicated value is configured", async () => {
    vi.stubEnv("CRON_SECRET", shared);
    const response = await POST(request(shared));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });
  it("accepts an independent push value without the old Cron value", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", dedicated);
    expect((await POST(request(dedicated))).status).toBe(200);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });
  it("rejects the old shared value after the dedicated value is configured", async () => {
    vi.stubEnv("CRON_SECRET", shared);
    vi.stubEnv("PUSH_DISPATCH_SECRET", dedicated);
    expect((await POST(request(shared))).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
    expect((await POST(request(dedicated))).status).toBe(200);
  });
  it.each(["", "short"])("fails closed for an explicitly weak dedicated value (%s)", async (value) => {
    vi.stubEnv("CRON_SECRET", shared);
    vi.stubEnv("PUSH_DISPATCH_SECRET", value);
    expect((await POST(request(shared))).status).toBe(401);
    expect((await POST(request(value))).status).toBe(401);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("rejects wrong credentials without returning the expected secret", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", dedicated);
    const response = await POST(request("wrong"));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(dedicated);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("returns a sanitized failure after an authorized dispatcher error", async () => {
    vi.stubEnv("PUSH_DISPATCH_SECRET", dedicated);
    mocks.dispatch.mockRejectedValue(new Error("private-provider-information"));
    const response = await POST(request(dedicated));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "push-dispatch-unavailable" });
  });
});
