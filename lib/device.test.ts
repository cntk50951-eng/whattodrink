import { describe, expect, it } from "vitest";

import {
  ANDROID_LOCATION_SETTINGS_INTENT,
  detectBrowser,
  detectPlatform,
} from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36";
const WECHAT_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.44 Safari/604.1";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.109 Safari/537.36";

describe("detectPlatform", () => {
  it("identifies iOS, Android, and desktop", () => {
    expect(detectPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(detectPlatform(IPHONE_CHROME)).toBe("ios");
    expect(detectPlatform(WECHAT_IOS)).toBe("ios");
    expect(detectPlatform(ANDROID_CHROME)).toBe("android");
    expect(detectPlatform(DESKTOP_CHROME)).toBe("other");
  });
});

describe("detectBrowser", () => {
  it("separates Safari, Chrome iOS, Chrome Android, and in-app webviews", () => {
    expect(detectBrowser(IPHONE_SAFARI)).toBe("safari");
    expect(detectBrowser(IPHONE_CHROME)).toBe("chrome-ios");
    expect(detectBrowser(ANDROID_CHROME)).toBe("chrome-android");
    expect(detectBrowser(WECHAT_IOS)).toBe("in-app");
    expect(detectBrowser(DESKTOP_CHROME)).toBe("other");
  });
});

describe("ANDROID_LOCATION_SETTINGS_INTENT", () => {
  it("targets the system location source settings", () => {
    expect(ANDROID_LOCATION_SETTINGS_INTENT).toContain("intent:");
    expect(ANDROID_LOCATION_SETTINGS_INTENT).toContain(
      "LOCATION_SOURCE_SETTINGS",
    );
  });
});
