import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import {
  APNS_COLLAPSE_ID_MAX_BYTES,
  apnsCollapseId,
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

describe("apnsCollapseId（第五輪審核：酒局／私約取消與完成的 collapse-id 實測 89／90 bytes，超過 APNs 64 bytes 上限）", () => {
  const uuid = (n: number) => `${String(n).repeat(8)}-1111-4222-8333-${String(n).repeat(12)}`;
  const bytes = (v: string) => Buffer.byteLength(v, "utf8");

  it("四種事件的原公式確實超限（回歸：證明這是真問題）", () => {
    expect(bytes(`party_cancelled-${uuid(1)}-${uuid(2)}`)).toBe(89);
    expect(bytes(`party_completed-${uuid(1)}-${uuid(2)}`)).toBe(89);
    expect(bytes(`invite_cancelled-${uuid(1)}-${uuid(2)}`)).toBe(90);
    expect(bytes(`invite_completed-${uuid(1)}-${uuid(2)}`)).toBe(90);
  });

  it("超限的收斂到 ≤64 bytes，且同一輸入永遠同一結果、不同收件人不撞", () => {
    for (const kind of ["party_cancelled", "party_completed", "invite_cancelled", "invite_completed"]) {
      const a = apnsCollapseId(`${kind}-${uuid(1)}-${uuid(2)}`);
      expect(bytes(a)).toBeLessThanOrEqual(APNS_COLLAPSE_ID_MAX_BYTES);
      expect(a.startsWith(`${kind}-`)).toBe(true);
      expect(apnsCollapseId(`${kind}-${uuid(1)}-${uuid(2)}`)).toBe(a);
      expect(apnsCollapseId(`${kind}-${uuid(1)}-${uuid(3)}`)).not.toBe(a);
      expect(apnsCollapseId(`${kind}-${uuid(4)}-${uuid(2)}`)).not.toBe(a);
    }
  });

  it("64 bytes 以內原樣返回（含剛好 64），65 開始收斂", () => {
    const exact = "a".repeat(64);
    expect(apnsCollapseId(exact)).toBe(exact);
    expect(apnsCollapseId("cheers-short-id")).toBe("cheers-short-id");
    const over = "a".repeat(65);
    expect(bytes(apnsCollapseId(over))).toBeLessThanOrEqual(APNS_COLLAPSE_ID_MAX_BYTES);
    expect(apnsCollapseId(over)).not.toBe(over);
  });

  it("含多位元組字元也按 bytes 算，不會漏判", () => {
    const wide = "友".repeat(30); // 90 bytes
    expect(bytes(wide)).toBe(90);
    expect(bytes(apnsCollapseId(wide))).toBeLessThanOrEqual(APNS_COLLAPSE_ID_MAX_BYTES);
  });
});
