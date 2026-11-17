import { randomUUID } from "node:crypto";

import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isTestEndpointsEnabled } from "@/lib/api/testOnly";
import { parseTestPush } from "@/lib/api/devices";
import { configuredPushDevices, hasPushChannel, nativePushConfigFromEnv, sendNativePush } from "@/lib/push/native";
import { computeBadge } from "@/lib/push/badge";
import { cheersCollapseId } from "@/lib/push/prefs";

export const runtime = "nodejs";

/** UR D.11: own-device testing only; omitted platform still targets the legacy iOS channel. */
export async function POST(req: Request): Promise<Response> {
  if (!isTestEndpointsEnabled(process.env.TEST_ENDPOINTS_ENABLED)) return apiError("not_found", "端点未上线", 404);
  const { userId } = await getAuthedClient(req);
  if (userId === null) return apiError("unauthorized", "未登录", 401);
  let raw: unknown;
  try { raw = await req.json(); } catch { return apiError("invalid_params", "body 需为 JSON", 400); }
  const parsed = parseTestPush(raw);
  if ("error" in parsed) return apiError("invalid_params", parsed.error, 400);
  const { event, platform } = parsed;
  const cfg = nativePushConfigFromEnv(process.env);
  if (!hasPushChannel(cfg, platform)) return apiError("internal", platform === "ios" ? "APNs 未配置" : "FCM 未配置", 500);
  const supa = await createServiceClient();
  const { data: devices } = await supa.from("devices").select("id,platform,push_token,environment,locale")
    .eq("user_id", userId).eq("platform", platform).eq("enabled", true).limit(10);
  const devs = configuredPushDevices(devices, cfg);
  if (devs.length === 0) return apiError("not_found", platform === "ios" ? "没有可用的 iOS 设备" : "没有可用的 AOS 设备", 404);
  const badge = await computeBadge(supa, userId);
  const titles = {
    cheers: { title: "[測試] 碰杯", thread: "cheers" },
    invite: { title: "[測試] 邀約", thread: "invite" },
    chat: { title: "[測試] 聊天", thread: "chat-test" },
  };
  const meta = titles[event];
  const eventId = "test:" + randomUUID();
  const expiresAt = String(Date.now() + 10 * 60_000);
  let sent = 0;
  for (const d of devs) {
    const res = await sendNativePush({
      cfg, platform: d.platform, env: d.environment === "sandbox" ? "sandbox" : "production",
      deviceToken: d.push_token,
      collapseId: event === "cheers" ? cheersCollapseId(userId) : "test-" + event + "-" + userId,
      payload: {
        aps: { alert: { title: meta.title, body: "[測試推送]" }, badge: badge.badge, sound: "default", "thread-id": meta.thread, "mutable-content": 0 },
        t: event, from: userId,
        ...(platform === "aos" ? { recipient_id: userId, event_id: eventId, expires_at: expiresAt } : {}),
      },
    });
    if (res.ok) sent += 1;
  }
  return apiOk({ sent, devices: devs.length });
}
