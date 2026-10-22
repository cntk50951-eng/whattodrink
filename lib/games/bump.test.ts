import { describe, expect, it } from "vitest";

import { BUMP_TOKEN_TTL_MS, issueBumpToken, parseBumpBody, verifyBumpToken } from "./bump";

const ROOM = "3f2b8c1e-5a4d-4e6f-9b0a-1c2d3e4f5a6b";
const KEY = "test-secret";

describe("碰一碰凭证", () => {
  it("签发后可验，带回房间 id，TTL 60 秒", () => {
    const t = issueBumpToken(ROOM, 1_700_000_000_000, KEY);
    expect(t).not.toBeNull();
    expect(Date.parse(t!.expiresAt) - 1_700_000_000_000).toBe(BUMP_TOKEN_TTL_MS);
    expect(verifyBumpToken(t!.token, 1_700_000_030_000, KEY)).toEqual({ ok: true, roomId: ROOM });
  });
  it("过期、篡改、换钥匙、格式坏都拒", () => {
    const t = issueBumpToken(ROOM, 1_700_000_000_000, KEY)!;
    expect(verifyBumpToken(t.token, 1_700_000_061_000, KEY)).toEqual({ ok: false, reason: "expired" });
    const [r, e, s] = t.token.split(".");
    expect(verifyBumpToken(`${r}.${Number(e) + 1}.${s}`, 1_700_000_001_000, KEY)).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyBumpToken(t.token, 1_700_000_001_000, "other")).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyBumpToken("abc", 0, KEY)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyBumpToken(`not-a-uuid.${e}.${s}`, 0, KEY)).toEqual({ ok: false, reason: "malformed" });
  });
  it("没有密钥不签发也不验", () => {
    expect(issueBumpToken(ROOM, 1, null)).toBeNull();
    expect(issueBumpToken("bad", 1, KEY)).toBeNull();
    expect(verifyBumpToken("x.y.z", 1, null)).toEqual({ ok: false, reason: "unavailable" });
  });
  it("body 校验", () => {
    expect(parseBumpBody(null)).toHaveProperty("error");
    expect(parseBumpBody({ token: "short" })).toHaveProperty("error");
    expect(parseBumpBody({ token: issueBumpToken(ROOM, 1, KEY)!.token })).toHaveProperty("token");
  });
});
