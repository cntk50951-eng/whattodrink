import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  appleClientSecret,
  appleRevocationGate,
  appleSiwaConfigFromEnv,
  normalizeP8,
  revokeAppleAuthorization,
  userHasAppleIdentity,
} from "./appleSignIn";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const cfg = { keyId: "KEYID12345", teamId: "TEAMID1234", clientId: "hk.example.app", keyP8: pem };
const env = {
  APPLE_SIWA_KEY_ID: cfg.keyId, APPLE_SIWA_TEAM_ID: cfg.teamId, APPLE_SIWA_CLIENT_ID: cfg.clientId, APPLE_SIWA_KEY_P8: pem,
};

type Reply = { status: number; body?: unknown };
function fakeFetch(replies: Reply[]) {
  const calls: Array<{ url: string; form: Record<string, string> }> = [];
  const fn = vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ url, form: Object.fromEntries(new URLSearchParams(init.body)) });
    const r = replies[calls.length - 1] ?? { status: 500 };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {}, text: async () => "" };
  });
  return { fn, calls };
}
const svcWith = (identities: Array<{ provider: string; identity_data?: { sub?: string }; provider_id?: string }> | null, error: unknown = null) =>
  ({ auth: { admin: { getUserById: async () => ({ data: { user: identities === null ? null : { identities } }, error }) } } }) as never;

describe("config and client secret", () => {
  it("needs all four env values", () => {
    expect(appleSiwaConfigFromEnv(env)).toEqual(cfg);
    for (const k of Object.keys(env)) expect(appleSiwaConfigFromEnv({ ...env, [k]: "" })).toBeNull();
    expect(appleSiwaConfigFromEnv({})).toBeNull();
  });
  it("accepts raw PEM, \\n-escaped single line, and base64 of the PEM", () => {
    expect(normalizeP8(pem)).toBe(pem.trim());
    expect(normalizeP8(pem.trim().replace(/\n/g, "\\n"))).toBe(pem.trim());
    expect(normalizeP8(Buffer.from(pem).toString("base64"))).toBe(pem);
  });
  it("signs an ES256 JWT Apple will accept: header, claims, and a verifiable signature", () => {
    const now = 1_800_000_000;
    const jwt = appleClientSecret(cfg, now);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "ES256", kid: cfg.keyId });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({
      iss: cfg.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: cfg.clientId,
    });
    expect(Buffer.from(s, "base64url")).toHaveLength(64);   // ieee-p1363 raw r||s
    expect(verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("revokeAppleAuthorization", () => {
  it("exchanges the code, then revokes the refresh token", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { refresh_token: "R", access_token: "A" } }, { status: 200 }]);
    expect(await revokeAppleAuthorization(cfg, "CODE", fn as never, 1_800_000_000)).toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual(["https://appleid.apple.com/auth/token", "https://appleid.apple.com/auth/revoke"]);
    expect(calls[0].form).toMatchObject({ client_id: cfg.clientId, code: "CODE", grant_type: "authorization_code" });
    expect(calls[1].form).toMatchObject({ client_id: cfg.clientId, token: "R", token_type_hint: "refresh_token" });
    expect(calls[0].form.client_secret.split(".")).toHaveLength(3);
  });
  it("falls back to the access token when no refresh token comes back", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { access_token: "A" } }, { status: 200 }]);
    expect(await revokeAppleAuthorization(cfg, "CODE", fn as never)).toEqual({ ok: true });
    expect(calls[1].form).toMatchObject({ token: "A", token_type_hint: "access_token" });
  });
  it("classifies failures: used/expired code, our own bad credentials, and outages", async () => {
    for (const [replies, kind] of [
      [[{ status: 400, body: { error: "invalid_grant" } }], "invalid_code"],
      [[{ status: 400, body: { error: "invalid_client" } }], "misconfigured"],
      [[{ status: 401 }], "misconfigured"],
      [[{ status: 503 }], "unavailable"],
      [[{ status: 200, body: {} }], "unavailable"],
      [[{ status: 200, body: { refresh_token: "R" } }, { status: 400 }], "misconfigured"],
      [[{ status: 200, body: { refresh_token: "R" } }, { status: 502 }], "unavailable"],
    ] as Array<[Reply[], string]>) {
      expect(await revokeAppleAuthorization(cfg, "C", fakeFetch(replies).fn as never)).toEqual({ ok: false, kind });
    }
  });
  it("never throws: network error or a broken key becomes 'unavailable'", async () => {
    const boom = vi.fn(async () => { throw new Error("socket hang up"); });
    expect(await revokeAppleAuthorization(cfg, "C", boom as never)).toEqual({ ok: false, kind: "unavailable" });
    expect(await revokeAppleAuthorization({ ...cfg, keyP8: "not a key" }, "C", fakeFetch([]).fn as never)).toEqual({ ok: false, kind: "unavailable" });
  });
});

describe("userHasAppleIdentity", () => {
  it("looks at Supabase identities", async () => {
    expect(await userHasAppleIdentity(svcWith([{ provider: "google" }, { provider: "apple" }]), "u")).toBe(true);
    expect(await userHasAppleIdentity(svcWith([{ provider: "google" }, { provider: "email" }]), "u")).toBe(false);
    expect(await userHasAppleIdentity(svcWith(null), "u")).toBe(false);
  });
  it("throws on a lookup error so deletion is retried rather than silently skipping revocation", async () => {
    await expect(userHasAppleIdentity(svcWith(null, { message: "x" }), "u")).rejects.toThrow("apple identity lookup failed");
  });
});

describe("appleRevocationGate", () => {
  const apple = svcWith([{ provider: "apple" }]);
  it("lets non-Apple accounts through without touching Apple", async () => {
    const { fn } = fakeFetch([]);
    expect(await appleRevocationGate(svcWith([{ provider: "google" }]), "u", null, env, fn as never)).toEqual({ proceed: true });
    expect(fn).not.toHaveBeenCalled();
  });
  it("asks for re-authorization when an Apple account sends no code (409) and does not call Apple", async () => {
    const { fn } = fakeFetch([]);
    expect(await appleRevocationGate(apple, "u", null, env, fn as never)).toMatchObject({ proceed: false, status: 409, code: "apple_reauth_required" });
    expect(fn).not.toHaveBeenCalled();
  });
  it("proceeds after a successful revoke", async () => {
    const { fn } = fakeFetch([{ status: 200, body: { refresh_token: "R" } }, { status: 200 }]);
    expect(await appleRevocationGate(apple, "u", "CODE", env, fn as never)).toEqual({ proceed: true });
  });
  it("400 for a rejected code, 503 for an outage — data stays untouched either way", async () => {
    expect(await appleRevocationGate(apple, "u", "C", env, fakeFetch([{ status: 400, body: { error: "invalid_grant" } }]).fn as never))
      .toMatchObject({ proceed: false, status: 400, code: "apple_code_invalid" });
    expect(await appleRevocationGate(apple, "u", "C", env, fakeFetch([{ status: 500 }]).fn as never))
      .toMatchObject({ proceed: false, status: 503 });
  });
  it("never blocks the user's right to delete on OUR misconfiguration (logs loudly, proceeds)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await appleRevocationGate(apple, "u", "C", {}, fakeFetch([]).fn as never)).toEqual({ proceed: true });
    expect(await appleRevocationGate(apple, "u", "C", env, fakeFetch([{ status: 401 }]).fn as never)).toEqual({ proceed: true });
    expect(err).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(err.mock.calls)).not.toMatch(/BEGIN PRIVATE KEY|CODE/);
    err.mockRestore();
  });
});

describe("wrong Apple ID guard", () => {
  const idTok = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString("base64url")}.s`;
  it("does not revoke when the authorized Apple ID is not the one linked to the account", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { refresh_token: "R", id_token: idTok("other") } }, { status: 200 }]);
    expect(await revokeAppleAuthorization(cfg, "C", fn as never, undefined, "mine")).toEqual({ ok: false, kind: "wrong_account" });
    expect(calls).toHaveLength(1);                                   // 沒有走到 revoke
  });
  it("revokes when the sub matches, and when we have nothing to compare against", async () => {
    expect(await revokeAppleAuthorization(cfg, "C", fakeFetch([{ status: 200, body: { refresh_token: "R", id_token: idTok("mine") } }, { status: 200 }]).fn as never, undefined, "mine")).toEqual({ ok: true });
    expect(await revokeAppleAuthorization(cfg, "C", fakeFetch([{ status: 200, body: { refresh_token: "R" } }, { status: 200 }]).fn as never, undefined, "mine")).toEqual({ ok: true });
    expect(await revokeAppleAuthorization(cfg, "C", fakeFetch([{ status: 200, body: { refresh_token: "R", id_token: idTok("any") } }, { status: 200 }]).fn as never)).toEqual({ ok: true });
  });
  it("the gate reads the linked sub from Supabase identity_data (or provider_id) and answers 400", async () => {
    const mismatch = fakeFetch([{ status: 200, body: { refresh_token: "R", id_token: idTok("other") } }]);
    expect(await appleRevocationGate(svcWith([{ provider: "apple", identity_data: { sub: "mine" } }]), "u", "C", env, mismatch.fn as never))
      .toMatchObject({ proceed: false, status: 400, code: "apple_code_invalid" });
    const viaProviderId = fakeFetch([{ status: 200, body: { refresh_token: "R", id_token: idTok("mine") } }, { status: 200 }]);
    expect(await appleRevocationGate(svcWith([{ provider: "apple", provider_id: "mine" }]), "u", "C", env, viaProviderId.fn as never)).toEqual({ proceed: true });
  });
});
