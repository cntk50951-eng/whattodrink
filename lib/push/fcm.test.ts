import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  apps: [] as { name: string }[], send: vi.fn(), init: vi.fn(), cert: vi.fn(),
}));
vi.mock("firebase-admin/app", () => ({
  cert: mocks.cert, getApps: () => mocks.apps,
  initializeApp: mocks.init,
}));
vi.mock("firebase-admin/messaging", () => ({ getMessaging: () => ({ send: mocks.send }) }));
import { fcmConfigFromEnv, fcmFailure, fcmMessage, sendFcm } from "./fcm";

const account = { type: "service_account", project_id: "hidrink-test", client_email: "test@hidrink-test.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nunit-test-only\n-----END PRIVATE KEY-----" };
const cfg = { projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key };
const args = { cfg, deviceToken: "fcm:unit-test-only", collapseId: "cheers-user", payload: { aps: { alert: { title: "Test", body: "A toast" }, badge: 3 }, t: "cheers", from: "peer", checkin_id: "post" } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.apps.splice(0);
  mocks.cert.mockReturnValue({});
  mocks.init.mockImplementation((_options: unknown, name: string) => { const app = { name }; mocks.apps.push(app); return app; });
  mocks.send.mockResolvedValue("projects/hidrink-test/messages/test");
});

describe("FCM credentials", () => {
  it("accepts only a complete server service-account configuration", () => {
    expect(fcmConfigFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account) })).toEqual(cfg);
    for (const value of ["", "{invalid", "null", "[]", "{}", JSON.stringify({ ...account, type: "android" }), JSON.stringify({ ...account, private_key: "" })]) expect(fcmConfigFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: value })).toBeNull();
    expect(fcmConfigFromEnv({})).toBeNull();
  });
  it("normalizes double escaped PEM newlines", () => {
    expect(fcmConfigFromEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ ...account, private_key: account.private_key.replace(/\n/g, "\\n") }) })?.privateKey).toBe(account.private_key);
  });
});

describe("FCM payload", () => {
  it("preserves event IDs and copies alert without sending an APNs envelope", () => {
    const m = fcmMessage(args);
    expect(m).toMatchObject({ token: args.deviceToken, notification: { title: "Test", body: "A toast" }, data: { t: "cheers", from_user_id: "peer", checkin_id: "post" }, android: { collapseKey: "cheers-user", notification: { tag: "cheers-user", notificationCount: 3 } } });
    expect(m.data).not.toHaveProperty("aps");
    expect(m.data).not.toHaveProperty("from");
    expect(m).not.toHaveProperty("apns");
  });
  it("carries friend and room targeting fields and stringifies scalar data", () => {
    expect(fcmMessage({ ...args, payload: { t: "game_invite", room_id: "room", code: "123456", count: 2, message_type: "reserved", "google.private": "reserved", "gcm.hidden": "reserved", nested: { private: true } } }).data).toEqual({ t: "game_invite", room_id: "room", code: "123456", count: "2" });
  });
});

describe("FCM sender", () => {
  it("reuses the named app for the same credentials and separates rotated credentials", async () => {
    expect(await sendFcm(args)).toMatchObject({ ok: true });
    await sendFcm(args);
    expect(mocks.init).toHaveBeenCalledTimes(1);
    await sendFcm({ ...args, cfg: { ...cfg, privateKey: cfg.privateKey + "\nrotated" } });
    expect(mocks.init).toHaveBeenCalledTimes(2);
  });
  it("reports safe errors without SDK message or token disclosure", async () => {
    mocks.send.mockRejectedValue({ code: "messaging/registration-token-not-registered", message: "sensitive-token" });
    expect(await sendFcm(args)).toEqual({ ok: false, status: 400, reason: "messaging/registration-token-not-registered" });
  });
  it("classifies transient failures for the existing orchestration retry", () => {
    expect(fcmFailure({ code: "messaging/message-rate-exceeded" })).toMatchObject({ status: 429 });
    expect(fcmFailure({ code: "messaging/server-unavailable" })).toMatchObject({ status: 503 });
    expect(fcmFailure({ code: "app/invalid-credential" })).toMatchObject({ status: 401 });
    expect(fcmFailure(new Error("do-not-log-this"))).toEqual({ ok: false, status: 0, reason: "fcm-error" });
  });
});
