import { describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ apns: vi.fn(), fcm: vi.fn() }));
vi.mock("./apns", async (original) => ({ ...await original<typeof import("./apns")>(), sendApn: mocked.apns }));
vi.mock("./fcm", async (original) => ({ ...await original<typeof import("./fcm")>(), sendFcm: mocked.fcm }));
import { configuredPushDevices, hasPushChannel, isDeadPushReason, nativePushConfigFromEnv, sendNativePush } from "./native";
import type { NativePushConfig } from "./native";

const apns = { keyId: "test", teamId: "test", keyP8: "test-only", topic: "hk.whattodrink.app" };
const fcm = { projectId: "hidrink-test", clientEmail: "test@hidrink-test.iam.gserviceaccount.com", privateKey: "test-only" };
const rows = [
  { id: "ios", platform: "ios", push_token: "a".repeat(64), environment: "sandbox", locale: "en" },
  { id: "aos", platform: "aos", push_token: "opaque:fcm", environment: "production", locale: "zh-Hant" },
  { id: "web", platform: "web", push_token: "a".repeat(64) }, null, { platform: "aos", push_token: "" },
];

describe("native device selection", () => {
  it("keeps AOS eligible when APNs credentials do not exist", () => {
    expect(configuredPushDevices(rows, { apns: null, fcm }).map((d) => d.id)).toEqual(["aos"]);
  });
  it("keeps the APNs-only deployment working without Firebase", () => {
    expect(configuredPushDevices(rows, { apns, fcm: null })).toEqual([rows[0]]);
  });
  it("ignores web, malformed rows and unconfigured channels", () => {
    expect(configuredPushDevices(rows, { apns: null, fcm: null })).toEqual([]);
    expect(configuredPushDevices(null, { apns, fcm })).toEqual([]);
    expect(configuredPushDevices(rows, { apns, fcm }).map((d) => d.id)).toEqual(["ios", "aos"]);
  });
  it("reads independent channel configuration without requiring either provider", () => {
    expect(nativePushConfigFromEnv({})).toEqual({ apns: null, fcm: null });
    expect(hasPushChannel({ apns: null, fcm }, "aos")).toBe(true);
    expect(hasPushChannel({ apns: null, fcm }, "ios")).toBe(false);
  });
});

describe("platform dispatch and stale registration handling", () => {
  it("passes iOS sandbox and payload unchanged to the original APNs sender", async () => {
    vi.clearAllMocks(); mocked.apns.mockResolvedValue({ ok: true, apnsId: "id" });
    const payload = { aps: { alert: { title: "Test" } }, t: "friend_request", from: "peer" };
    await sendNativePush({ cfg: { apns, fcm }, platform: "ios", env: "sandbox", deviceToken: "a".repeat(64), collapseId: "friend-user", payload });
    expect(mocked.apns).toHaveBeenCalledWith(expect.objectContaining({ cfg: apns, env: "sandbox", payload }));
    expect(mocked.fcm).not.toHaveBeenCalled();
  });
  it("uses FCM for AOS without touching APNs", async () => {
    vi.clearAllMocks(); mocked.fcm.mockResolvedValue({ ok: true, messageId: "id" });
    await sendNativePush({ cfg: { apns: null, fcm }, platform: "aos", env: "production", deviceToken: "opaque:fcm", collapseId: "test", payload: { t: "cheers" } });
    expect(mocked.fcm).toHaveBeenCalledWith(expect.objectContaining({ cfg: fcm, deviceToken: "opaque:fcm" }));
    expect(mocked.apns).not.toHaveBeenCalled();
  });
  it("does not call a provider with missing credentials", async () => {
    const cfg: NativePushConfig = { apns: null, fcm: null };
    expect(await sendNativePush({ cfg, platform: "aos", env: "production", deviceToken: "x", collapseId: "test", payload: {} })).toMatchObject({ ok: false, reason: "not-configured" });
  });
  it("removes only explicit dead-registration errors, not generic invalid payloads", () => {
    for (const reason of ["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic", "messaging/registration-token-not-registered"]) expect(isDeadPushReason(reason)).toBe(true);
    for (const reason of ["messaging/invalid-argument", "messaging/sender-id-mismatch", "messaging/server-unavailable"]) expect(isDeadPushReason(reason)).toBe(false);
  });
});
