/**
 * Sign in with Apple 刪帳號撤銷（Apple TN3194：提供 Apple 登入的 App 刪帳號時必須撤銷 token）。
 *
 * 做法（不存任何 Apple token）：客戶端刪號前再用 Apple 授權一次，把一次性 authorization code 隨 `DELETE /me` 送來；
 * 這裡用 SIWA 專用 key 簽 client secret → `POST /auth/token` 換 refresh token → `POST /auth/revoke` 立刻撤銷。
 * 順序：**先撤銷、後刪資料**（撤銷失敗就不動資料，用戶可用新 code 重試）。
 * 原生登入走 id_token，登入本身不需要這把 key；它只用於刪帳號撤銷。code 只在客戶端授權後約 5 分鐘內有效且只能用一次。
 * 絕不記錄 code／secret／token 內容。
 */
import { createPrivateKey, sign } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppleSiwaConfig = { keyId: string; teamId: string; clientId: string; keyP8: string };

export function appleSiwaConfigFromEnv(env: Record<string, string | undefined>): AppleSiwaConfig | null {
  const keyId = (env.APPLE_SIWA_KEY_ID ?? "").trim();
  const teamId = (env.APPLE_SIWA_TEAM_ID ?? "").trim();
  const clientId = (env.APPLE_SIWA_CLIENT_ID ?? "").trim();
  const keyP8 = env.APPLE_SIWA_KEY_P8 ?? "";
  if (keyId === "" || teamId === "" || clientId === "" || keyP8.trim() === "") return null;
  return { keyId, teamId, clientId, keyP8 };
}

/** Vercel 環境變量裡 PEM 可能是原文、`\n` 轉義的單行，或整段 base64：都接受。 */
export function normalizeP8(keyP8: string): string {
  const t = keyP8.trim().replace(/\\n/g, "\n");
  if (t.includes("BEGIN PRIVATE KEY")) return t;
  const pem = Buffer.from(t.replace(/\s+/g, ""), "base64").toString("utf8");
  return pem.includes("BEGIN PRIVATE KEY") ? pem : t;
}

const APPLE_AUD = "https://appleid.apple.com";

/** client secret＝用 SIWA key 簽的 ES256 JWT（Apple 允許最長 6 個月；這裡只簽 5 分鐘，每次現簽，所以不需要人工輪換）。 */
export function appleClientSecret(cfg: AppleSiwaConfig, nowSec: number = Math.floor(Date.now() / 1000), ttlSec = 300): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: cfg.keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: cfg.teamId, iat: nowSec, exp: nowSec + ttlSec, aud: APPLE_AUD, sub: cfg.clientId }),
  ).toString("base64url");
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey({ key: normalizeP8(cfg.keyP8), format: "pem" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${sig.toString("base64url")}`;
}

export type AppleRevokeResult =
  | { ok: true }
  | { ok: false; kind: "invalid_code" | "wrong_account" | "unavailable" | "misconfigured" };

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

async function postForm(fetchFn: FetchFn, path: string, form: Record<string, string>) {
  return fetchFn(`${APPLE_AUD}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(8000),
  });
}

/** Apple 的 400 錯誤體：{error:"invalid_grant"} 是 code 用過／過期；invalid_client 是我們自己的配置（key／team／client_id）不對。 */
async function appleErrorOf(res: Pick<Response, "json">): Promise<string> {
  try {
    const b = (await res.json()) as { error?: unknown };
    return typeof b.error === "string" ? b.error : "";
  } catch {
    return "";
  }
}

/** id_token 是 Apple 對我們剛發出的 code 兌換請求的直接回包（TLS），只取 `sub`，不做簽名驗證。 */
function subOfIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const p = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as { sub?: unknown };
    return typeof p.sub === "string" && p.sub !== "" ? p.sub : null;
  } catch {
    return null;
  }
}

export async function revokeAppleAuthorization(
  cfg: AppleSiwaConfig,
  authorizationCode: string,
  fetchFn: FetchFn = fetch as unknown as FetchFn,
  nowSec?: number,
  expectedSub: string | null = null,
): Promise<AppleRevokeResult> {
  try {
    const secret = appleClientSecret(cfg, nowSec);
    const tokenRes = await postForm(fetchFn, "/auth/token", {
      client_id: cfg.clientId,
      client_secret: secret,
      code: authorizationCode,
      grant_type: "authorization_code",
    });
    if (!tokenRes.ok) {
      if (tokenRes.status === 400) {
        const err = await appleErrorOf(tokenRes);
        return { ok: false, kind: err === "invalid_grant" ? "invalid_code" : "misconfigured" };
      }
      return { ok: false, kind: tokenRes.status === 401 ? "misconfigured" : "unavailable" };
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: unknown; access_token?: unknown; id_token?: unknown };
    // 用戶在授權框裡可能選了另一個 Apple ID：不是登入時綁的那個就不撤銷（撤銷的是別人的授權，也撤不掉我們要撤的）
    const gotSub = subOfIdToken(tokens.id_token);
    if (expectedSub !== null && gotSub !== null && gotSub !== expectedSub) return { ok: false, kind: "wrong_account" };
    const refresh = typeof tokens.refresh_token === "string" ? tokens.refresh_token : "";
    const access = typeof tokens.access_token === "string" ? tokens.access_token : "";
    const [token, hint] = refresh !== "" ? [refresh, "refresh_token"] : [access, "access_token"];
    if (token === "") return { ok: false, kind: "unavailable" };
    const revokeRes = await postForm(fetchFn, "/auth/revoke", {
      client_id: cfg.clientId,
      client_secret: secret,
      token,
      token_type_hint: hint,
    });
    if (revokeRes.ok) return { ok: true };
    if (revokeRes.status === 400 || revokeRes.status === 401) return { ok: false, kind: "misconfigured" };
    return { ok: false, kind: "unavailable" };
  } catch {
    // 網絡／超時／簽名失敗（key 格式壞）：不外泄任何內容
    return { ok: false, kind: "unavailable" };
  }
}

type Svc = Pick<SupabaseClient, "auth">;

/** 這個登入帳號綁的 Apple 身份（Supabase identities）；沒綁回 null，sub 取不到時為 ""。 */
export async function findAppleIdentity(svc: Svc, userId: string): Promise<{ sub: string } | null> {
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error !== null) throw new Error("apple identity lookup failed");
  const identities = (data.user as {
    identities?: Array<{ provider?: string; provider_id?: string; identity_data?: { sub?: string } }>;
  } | null)?.identities ?? [];
  const apple = identities.find((i) => i.provider === "apple");
  if (apple === undefined) return null;
  return { sub: apple.identity_data?.sub ?? apple.provider_id ?? "" };
}

export async function userHasAppleIdentity(svc: Svc, userId: string): Promise<boolean> {
  return (await findAppleIdentity(svc, userId)) !== null;
}

export type AppleRevocationOutcome =
  | { proceed: true }
  | { proceed: false; status: 400 | 409 | 503; code: "apple_code_invalid" | "apple_reauth_required" | "internal"; message: string };

/**
 * 刪帳號前的 Apple 撤銷關卡。
 * - 沒綁 Apple：放行。
 * - 綁了但**伺服器沒配 SIWA key／key 被 Apple 判無效**：放行並大聲記錄（用戶刪帳號的權利不能被我們的配置問題擋住）。
 * - 綁了、配置正常、沒帶 code：409 apple_reauth_required，客戶端再授權後重試。
 * - code 被 Apple 拒（過期／已用）：400 apple_code_invalid，客戶端重新授權。
 * - Apple 暫時不可達：503，稍後重試（資料還沒動）。
 */
export async function appleRevocationGate(
  svc: Svc,
  userId: string,
  authorizationCode: string | null,
  env: Record<string, string | undefined> = process.env,
  fetchFn?: FetchFn,
): Promise<AppleRevocationOutcome> {
  const identity = await findAppleIdentity(svc, userId);
  if (identity === null) return { proceed: true };
  const cfg = appleSiwaConfigFromEnv(env);
  if (cfg === null) {
    console.error("[siwa] account has Apple identity but APPLE_SIWA_* is not configured; deletion proceeds WITHOUT revoking");
    return { proceed: true };
  }
  if (authorizationCode === null) {
    return { proceed: false, status: 409, code: "apple_reauth_required", message: "此帳號用 Apple 登入，刪除前需要再用 Apple 授權一次" };
  }
  const r = await revokeAppleAuthorization(cfg, authorizationCode, fetchFn, undefined, identity.sub === "" ? null : identity.sub);
  if (r.ok) return { proceed: true };
  if (r.kind === "wrong_account") {
    return { proceed: false, status: 400, code: "apple_code_invalid", message: "請用登入時的 Apple ID 授權" };
  }
  if (r.kind === "invalid_code") {
    return { proceed: false, status: 400, code: "apple_code_invalid", message: "Apple 授權已失效，請重新授權後再試" };
  }
  if (r.kind === "misconfigured") {
    console.error("[siwa] Apple rejected our client credentials (check APPLE_SIWA_KEY_ID/TEAM_ID/CLIENT_ID/KEY_P8); deletion proceeds WITHOUT revoking");
    return { proceed: true };
  }
  return { proceed: false, status: 503, code: "internal", message: "Apple 暫時無法連線，請稍後重試" };
}
