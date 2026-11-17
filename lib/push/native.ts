/** UR D.11: platform dispatch. The iOS branch still calls the original APNs implementation. */
import type { NativePlatform } from "@/lib/api/devices";

import { apnsConfigFromEnv, sendApn } from "./apns";
import type { ApnsConfig, ApnsEnv } from "./apns";
import { fcmConfigFromEnv, sendFcm } from "./fcm";
import type { FcmConfig } from "./fcm";

export type NativePushConfig = { apns: ApnsConfig | null; fcm: FcmConfig | null };
export type PushDevice = { id: string; platform: NativePlatform; push_token: string; environment: string; locale: string | null };
export type PushResult = { ok: true } | { ok: false; status: number; reason: string };

export function nativePushConfigFromEnv(env: Record<string, string | undefined>): NativePushConfig {
  return { apns: apnsConfigFromEnv(env), fcm: fcmConfigFromEnv(env) };
}

export function hasPushChannel(config: NativePushConfig, platform?: NativePlatform): boolean {
  if (platform === "ios") return config.apns !== null;
  if (platform === "aos") return config.fcm !== null;
  return config.apns !== null || config.fcm !== null;
}

export function configuredPushDevices(raw: unknown, config: NativePushConfig): PushDevice[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value: unknown) => {
    if (typeof value !== "object" || value === null) return [];
    const r = value as Record<string, unknown>;
    if ((r.platform !== "ios" && r.platform !== "aos") || !hasPushChannel(config, r.platform)
      || typeof r.id !== "string" || typeof r.push_token !== "string" || r.push_token.length === 0) return [];
    return [{
      id: r.id, platform: r.platform, push_token: r.push_token,
      environment: r.environment === "sandbox" ? "sandbox" : "production",
      locale: typeof r.locale === "string" ? r.locale : null,
    }];
  });
}

export function isDeadPushReason(reason: string): boolean {
  return ["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic",
    "messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(reason);
}

export async function sendNativePush(args: {
  cfg: NativePushConfig; platform: NativePlatform; env: ApnsEnv; deviceToken: string;
  collapseId: string; payload: Record<string, unknown>;
}): Promise<PushResult> {
  if (args.platform === "ios" && args.cfg.apns !== null) {
    return sendApn({ ...args, cfg: args.cfg.apns });
  }
  if (args.platform === "aos" && args.cfg.fcm !== null) {
    return sendFcm({ ...args, cfg: args.cfg.fcm });
  }
  return { ok: false, status: 503, reason: "not-configured" };
}
