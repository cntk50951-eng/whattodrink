import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), service: vi.fn(),
  query: {
    upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), select: vi.fn(), eq: vi.fn(),
    order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
    then: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({ getAuthedClient: mocks.auth, createServiceClient: mocks.service }));
// Existing Vitest has no @ alias mapping; use the real pure helpers via local factories.
vi.mock("@/lib/api/envelope", () => import("../../../../lib/api/envelope"));
vi.mock("@/lib/api/devices", () => import("../../../../lib/api/devices"));
import { DELETE, PATCH, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  for (const method of ["upsert", "update", "delete", "select", "eq", "order", "limit"] as const) mocks.query[method].mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({ data: { id: "device-id" }, error: null });
  mocks.query.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve));
  mocks.service.mockResolvedValue({ from: () => mocks.query });
});
function request(method: string, body: unknown): Request {
  return new Request("https://example.invalid/api/v1/devices", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("device API platform compatibility and ownership", () => {
  it("registers an opaque AOS token without exposing it in the response", async () => {
    const token = "opaque:fcm-unit-test";
    const res = await POST(request("POST", { platform: "aos", push_token: token, locale: "en" }));
    expect(res.status).toBe(200);
    expect(mocks.query.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", platform: "aos", push_token: token, environment: "production", enabled: true, locale: "en" }), { onConflict: "platform,push_token" });
    const body = await res.text();
    expect(body).toContain("device-id");
    expect(body).not.toContain(token);
  });
  it("keeps the existing iOS sandbox registration", async () => {
    const res = await POST(request("POST", { platform: "ios", push_token: "a".repeat(64), environment: "sandbox" }));
    expect(res.status).toBe(200);
    expect(mocks.query.upsert).toHaveBeenCalledWith(expect.objectContaining({ platform: "ios", environment: "sandbox" }), expect.anything());
  });
  it("rejects opaque tokens on iOS before touching the device table", async () => {
    expect((await POST(request("POST", { platform: "ios", push_token: "opaque:fcm" }))).status).toBe(400);
    expect(mocks.service).not.toHaveBeenCalled();
  });
  it("supports AOS permission updates limited to the authenticated owner", async () => {
    expect((await PATCH(request("PATCH", { platform: "aos", push_token: "opaque:fcm", enabled: false }))).status).toBe(200);
    expect(mocks.query.update).toHaveBeenCalledWith({ enabled: false, updated_at: expect.any(String) });
    expect(mocks.query.eq).toHaveBeenCalledWith("platform", "aos");
    expect(mocks.query.eq).toHaveBeenCalledWith("push_token", "opaque:fcm");
    expect(mocks.query.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("supports AOS unregistration without removing another owner's row", async () => {
    expect((await DELETE(request("DELETE", { platform: "aos", push_token: "opaque:fcm" }))).status).toBe(200);
    expect(mocks.query.delete).toHaveBeenCalled();
    expect(mocks.query.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("requires authentication for every mutation", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    for (const [method, handler] of [["POST", POST], ["PATCH", PATCH], ["DELETE", DELETE]] as const) {
      expect((await handler(request(method, { platform: "aos", push_token: "opaque:fcm" }))).status).toBe(401);
    }
    expect(mocks.service).not.toHaveBeenCalled();
  });
});
