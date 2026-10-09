import { getAuthedClient, createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { isTestEndpointsEnabled } from "@/lib/api/testOnly";
import { sendApn, apnsConfigFromEnv } from "@/lib/push/apns";
import { computeBadge } from "@/lib/push/badge";
import { cheersCollapseId } from "@/lib/push/prefs";

const EVENTS = ["cheers", "invite", "chat"] as const;

/**
 * UR D.9 推送联调端点（测试专用，生产 404，沿 testOnly 口径）。
 * `POST /api/v1/devices/test-push {event}` —— 给调用者自己的 enabled ios 设备
 * 发一条对应样式（免找第二账号；badge 照算；走真实 APNs 通道）。
 */
export async function POST(req: Request): Promise<Response> {
  if (!isTestEndpointsEnabled(process.env.TEST_ENDPOINTS_ENABLED)) {
    return apiError("not_found", "端点未上线", 404);
  }
  const { userId } = await getAuthedClient(req);
  if (userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {
    return apiError("invalid_params", "body 需为 JSON", 400);
  }
  const event = (raw as Record<string, unknown>).event;
  if (typeof event !== "string" || !(EVENTS as readonly string[]).includes(event)) {
    return apiError("invalid_params", "event 只要 cheers|invite|chat", 400);
  }
  const cfg = apnsConfigFromEnv(process.env as Record<string, string | undefined>);
  if (cfg === null) {
    return apiError("internal", "APNs 未配置", 500);
  }
  const supa = await createServiceClient();
  const { data: devices } = await supa
    .from("devices")
    .select("id,push_token,environment,locale")
    .eq("user_id", userId)
    .eq("platform", "ios")
    .eq("enabled", true)
    .limit(10);
  const devs = (((devices ?? []) as unknown[]) as Record<string, unknown>[]).filter(
    (d) => typeof d.id === "string" && typeof d.push_token === "string" && d.push_token !== "",
  );
  if (devs.length === 0) {
    return apiError("not_found", "没有可用的 iOS 设备", 404);
  }
  const badge = await computeBadge(supa, userId);
  const titles: Record<string, { title: string; thread: string }> = {
    cheers: { title: "[測試] 碰杯", thread: "cheers" },
    invite: { title: "[測試] 邀約", thread: "invite" },
    chat: { title: "[測試] 聊天", thread: "chat-test" },
  };
  const meta = titles[event];
  let sent = 0;
  for (const d of devs) {
    const env = d.environment === "sandbox" ? "sandbox" : "production";
    const res = await sendApn({
      cfg,
      env,
      deviceToken: d.push_token as string,
      collapseId: event === "cheers" ? cheersCollapseId(userId) : `test-${event}-${userId}`,
      payload: {
        aps: {
          alert: { title: meta.title, body: "[測試推送]" },
          badge: badge.badge,
          sound: "default",
          "thread-id": meta.thread,
          "mutable-content": 0,
        },
        t: event === "cheers" ? "cheers" : event === "invite" ? "invite" : "chat",
        from: userId,
      },
    });
    if (res.ok) sent += 1;
  }
  return apiOk({ sent, devices: devs.length });
}
