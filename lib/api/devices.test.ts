import { describe, expect, it } from "vitest";
import { parseDeviceIdentity, parseTestPush } from "./devices";

describe("device identity: legacy APNs and AOS FCM", () => {
  it("keeps iOS/web hex bounds and rejects opaque Android tokens on iOS", () => {
    for (const platform of ["ios", "web"]) {
      for (const n of [64, 200]) expect(parseDeviceIdentity({ platform, push_token: "a".repeat(n) })).toEqual({ platform, push_token: "a".repeat(n) });
      for (const token of ["a".repeat(63), "a".repeat(201), "fcm:opaque-token"]) expect(parseDeviceIdentity({ platform, push_token: token })).toHaveProperty("error");
    }
  });
  it("accepts opaque AOS tokens without changing their value", () => {
    for (const token of ["identifier:FCM_-opaque.123", "x".repeat(4096)]) expect(parseDeviceIdentity({ platform: "aos", push_token: token })).toEqual({ platform: "aos", push_token: token });
  });
  it("rejects invalid platform, shape, types, whitespace and oversized values", () => {
    for (const raw of [null, [], {}, { platform: "android", push_token: "x" }, { platform: "aos", push_token: 123 }]) expect(parseDeviceIdentity(raw)).toHaveProperty("error");
    for (const push_token of ["", "x".repeat(4097), "x y", "x\ny", "\tx", "x\u0000y"]) expect(parseDeviceIdentity({ platform: "aos", push_token })).toHaveProperty("error");
  });
  it("does not leak rejected token contents into validation errors", () => {
    expect(JSON.stringify(parseDeviceIdentity({ platform: "ios", push_token: "private-value" }))).not.toContain("private-value");
  });
});

describe("test push input", () => {
  it("defaults to iOS and opts into AOS explicitly", () => {
    expect(parseTestPush({ event: "cheers" })).toEqual({ event: "cheers", platform: "ios" });
    expect(parseTestPush({ event: "chat", platform: "aos" })).toEqual({ event: "chat", platform: "aos" });
  });
  it("rejects malformed inputs and nonnative targets", () => {
    for (const input of [null, [], {}, { event: "unknown" }, { event: "cheers", platform: "web" }, { event: "cheers", platform: null }]) expect(parseTestPush(input)).toHaveProperty("error");
  });
});
