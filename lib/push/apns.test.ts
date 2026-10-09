import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  apnsConfigFromEnv,
  apnsProviderToken,
  clearApnsTokenCache,
} from "./apns";

describe("apnsConfigFromEnv", () => {
  it("缺任一即 null（无 key 静默跳过）", () => {
    expect(apnsConfigFromEnv({})).toBeNull();
    expect(
      apnsConfigFromEnv({ APNS_KEY_ID: "a", APNS_TEAM_ID: "b", APNS_KEY_P8: "c" }),
    ).toBeNull();
    expect(
      apnsConfigFromEnv({
        APNS_KEY_ID: "a",
        APNS_TEAM_ID: "b",
        APNS_KEY_P8: "c",
        APNS_TOPIC: "t",
      }),
    ).not.toBeNull();
  });
});

describe("apnsProviderToken", () => {
  it("ES256 自签自验＋50min 缓存复用", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const cfg = { keyId: "K1", teamId: "T1", keyP8: pem, topic: "t" };
    clearApnsTokenCache();
    const t1 = apnsProviderToken(cfg, 1_000_000);
    const t2 = apnsProviderToken(cfg, 1_000_000 + 60_000);
    expect(t2).toBe(t1);
    const [h, p, s] = t1.split(".");
    const v = createVerify("sha256");
    v.update(`${h}.${p}`);
    const sig = Buffer.from(s, "base64url");
    expect(v.verify({ key: publicKey, dsaEncoding: "ieee-p1363" }, sig)).toBe(true);
    // 过期重签（51min 后新 token）。
    const t3 = apnsProviderToken(cfg, 1_000_000 + 51 * 60_000);
    expect(t3 === t1).toBe(false);
    clearApnsTokenCache();
  });
});
