import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createServer, type ClientHttp2Session, type ServerHttp2Session } from "node:http2";
import type { AddressInfo } from "node:net";
import {
  APNS_COLLAPSE_ID_MAX_BYTES,
  apnsCollapseId,
  apnsConfigFromEnv,
  apnsProviderToken,
  apnsSessionFor,
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

/** 回環上發一個請求：回狀態碼，或失敗代碼（絕不拋出） */
function ask(session: ClientHttp2Session): Promise<number | string> {
  return new Promise((resolve) => {
    const stream = session.request({ ":method": "POST", ":path": "/3/device/x" });
    stream.on("response", (h) => resolve(Number(h[":status"])));
    stream.on("error", (e: NodeJS.ErrnoException) => resolve(e.code ?? e.message));
    stream.resume();
    stream.end("{}");
  });
}
const tick = () => new Promise((r) => setTimeout(r, 100));

describe("apnsSessionFor（DEF-20261127-039）", () => {
  it("連不上時只讓該請求失敗，不冒出未捕獲錯誤，下次重新建連", async () => {
    const uncaught: unknown[] = [];
    const listener = (e: unknown) => uncaught.push(e);
    process.on("uncaughtException", listener);
    try {
      const url = "http://127.0.0.1:1";
      const first = apnsSessionFor(url);
      expect(typeof (await ask(first))).toBe("string");
      await tick();
      const second = apnsSessionFor(url);
      expect(second).not.toBe(first);
      await ask(second);
      await tick();
      expect(uncaught).toEqual([]);
    } finally {
      process.off("uncaughtException", listener);
    }
  });

  it("收到 GOAWAY 後即使還有在途請求，新請求也走新連線", async () => {
    const server = createServer();
    const serverSessions: ServerHttp2Session[] = [];
    let streams = 0;
    server.on("session", (x) => serverSessions.push(x));
    server.on("stream", (stream) => {
      stream.respond({ ":status": 200 });
      if (++streams > 1) stream.end(); // 第一個請求一直掛著，讓舊連線關不掉
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const old = apnsSessionFor(url);
      expect(await ask(old)).toBe(200);
      serverSessions[0].goaway();
      await tick();
      const next = apnsSessionFor(url);
      expect(next).not.toBe(old);
      expect(await ask(next)).toBe(200);
      expect(apnsSessionFor(url)).toBe(next); // 健康連線照舊復用
      old.destroy();
      next.destroy();
    } finally {
      for (const x of serverSessions) x.destroy();
      server.close();
    }
  });
});
