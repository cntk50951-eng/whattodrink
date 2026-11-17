/** UR D.11: shared device identity validation; iOS/web keep the legacy APNs format. */
export type DevicePlatform = "web" | "ios" | "aos";
export type NativePlatform = Exclude<DevicePlatform, "web">;
export type DeviceIdentity = { platform: DevicePlatform; push_token: string };

export function parseDeviceIdentity(raw: unknown): DeviceIdentity | { error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  if (r.platform !== "web" && r.platform !== "ios" && r.platform !== "aos") return { error: "platform 非法" };
  if (typeof r.push_token !== "string") return { error: "push_token 非法" };
  if (r.platform === "aos") {
    // FCM identifiers are opaque. Bound size and reject whitespace/control characters; never coerce to hex.
    if (!/^[\x21-\x7e]{1,4096}$/.test(r.push_token)) return { error: "push_token 非法（FCM 1–4096 字符，不含空白）" };
  } else if (!/^[0-9a-fA-F]{64,200}$/.test(r.push_token)) {
    return { error: "push_token 非法（hex 64–200）" };
  }
  return { platform: r.platform, push_token: r.push_token };
}

const TEST_EVENTS = ["cheers", "invite", "chat"] as const;
export type TestPushEvent = (typeof TEST_EVENTS)[number];

export function parseTestPush(raw: unknown): { event: TestPushEvent; platform: NativePlatform } | { error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: "body 需为对象" };
  const r = raw as Record<string, unknown>;
  if (typeof r.event !== "string" || !(TEST_EVENTS as readonly string[]).includes(r.event)) {
    return { error: "event 只要 cheers|invite|chat" };
  }
  const platform = r.platform === undefined ? "ios" : r.platform;
  if (platform !== "ios" && platform !== "aos") return { error: "platform 只要 ios|aos" };
  return { event: r.event as TestPushEvent, platform };
}
