/** UR D.11: server-only FCM transport. Credentials are read only from the server environment. */
import { createHash } from "node:crypto";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { Message } from "firebase-admin/messaging";

export type FcmConfig = { projectId: string; clientEmail: string; privateKey: string };
export type FcmResult = { ok: true; messageId: string } | { ok: false; status: number; reason: string };
const TTL_MS = 24 * 60 * 60 * 1000;

export function fcmConfigFromEnv(env: Record<string, string | undefined>): FcmConfig | null {
  const value = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!value) return null;
  try {
    const raw: unknown = JSON.parse(value);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.type !== "service_account" || typeof r.project_id !== "string"
      || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(r.project_id)
      || typeof r.client_email !== "string" || !/@[^@]+\.gserviceaccount\.com$/.test(r.client_email)
      || typeof r.private_key !== "string" || !r.private_key.includes("BEGIN PRIVATE KEY")) return null;
    return { projectId: r.project_id, clientEmail: r.client_email, privateKey: r.private_key.replace(/\\n/g, "\n") };
  } catch {
    // Invalid configuration must not print the JSON, key, or a parsing exception containing its value.
    return null;
  }
}

/** Keep the existing event IDs while translating the APNs envelope into an Android notification. */
export function fcmMessage(args: { deviceToken: string; collapseId: string; payload: Record<string, unknown> }): Message {
  const aps = args.payload.aps;
  const a = typeof aps === "object" && aps !== null ? aps as Record<string, unknown> : {};
  const alert = a.alert;
  const copy = typeof alert === "object" && alert !== null ? alert as Record<string, unknown> : {};
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(args.payload)) {
    // FCM reserves from/message_type/google.*/gcm.*; iOS keeps its original from field.
    if (key === "aps" || key === "message_type" || key.startsWith("google.") || key.startsWith("gcm.")) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") data[key === "from" ? "from_user_id" : key] = String(value);
  }
  const badge = typeof a.badge === "number" && Number.isFinite(a.badge) ? Math.max(0, Math.floor(a.badge)) : 0;
  // Data-only is intentional: Android checks the active recipient before showing anything,
  // including in background. Firebase's automatic notification UI bypasses that guard.
  data.title = typeof copy.title === "string" ? copy.title : data.title ?? "hi drink";
  data.body = typeof copy.body === "string" ? copy.body : data.body ?? "";
  data.collapse_id = args.collapseId;
  data.badge = String(badge);
  const now = Date.now();
  const requestedExpiry = Number(data.expires_at);
  const expiresAt = Number.isFinite(requestedExpiry) && requestedExpiry > 0 ? requestedExpiry : now + TTL_MS;
  data.expires_at = String(expiresAt);
  return {
    token: args.deviceToken,
    data,
    android: {
      priority: "high",
      ttl: Math.max(0, Math.min(TTL_MS, expiresAt - now)),
      // 可摺疊訊息每台裝置只給 20 條突發、每 3 分鐘補 1 條，聊天熱絡時會嚴重延遲；
      // 聊天不設 collapseKey，通知欄裡的替換仍由 Android 按 data.collapse_id 做
      ...(data.t === "chat" ? {} : { collapseKey: args.collapseId }),
    },
  };
}

/** Return a safe error code only: SDK exception messages can contain identifiers. */
export function fcmFailure(error: unknown): Extract<FcmResult, { ok: false }> {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  const reason = typeof code === "string" && /^(messaging|app|auth)\/[a-z-]+$/.test(code) ? code : "fcm-error";
  const status = (reason.includes("rate-exceeded") || reason === "messaging/quota-exceeded") ? 429
    : reason === "messaging/server-unavailable" ? 503
    : reason === "messaging/internal-error" ? 500
    : reason === "messaging/mismatched-credential" || reason === "messaging/sender-id-mismatch" ? 403
    : reason.includes("credential") || reason === "messaging/authentication-error" ? 401
    : reason === "fcm-error" ? 0 : 400;
  return { ok: false, status, reason };
}

export async function sendFcm(args: { cfg: FcmConfig; deviceToken: string; collapseId: string; payload: Record<string, unknown> }): Promise<FcmResult> {
  try {
    // Separate named app: never reuse another project's credentials, including after key rotation.
    const digest = createHash("sha256").update(JSON.stringify(args.cfg)).digest("hex").slice(0, 16);
    const name = "wtd-aos-push-" + digest;
    const app = getApps().find((candidate) => candidate.name === name)
      ?? initializeApp({ projectId: args.cfg.projectId, credential: cert(args.cfg) }, name);
    const messageId = await getMessaging(app).send(fcmMessage(args));
    return { ok: true, messageId };
  } catch (error) {
    return fcmFailure(error);
  }
}
