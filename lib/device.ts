/**
 * Client platform / browser detection for the geo-permission overlay (UR1.1).
 *
 * Pure functions over a UA string — unit tested. The overlay needs this
 * because the fix differs per platform: iOS Chrome vs Safari have different
 * Settings paths, in-app webviews (WeChat/IG) block geolocation entirely,
 * and only Android offers a settings deep-link from the web.
 */

export type DevicePlatform = "ios" | "android" | "other";

export type DeviceBrowser =
  | "safari"
  | "chrome-ios"
  | "chrome-android"
  | "in-app"
  | "other";

const IN_APP_PATTERN = /micromessenger|fban|fbios|fbav|instagram|line\//;

export function detectPlatform(userAgent: string): DevicePlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

export function detectBrowser(userAgent: string): DeviceBrowser {
  const ua = userAgent.toLowerCase();
  if (IN_APP_PATTERN.test(ua)) return "in-app";
  if (/crios/.test(ua)) return "chrome-ios";
  if (/iphone|ipad|ipod/.test(ua)) return "safari";
  if (/android/.test(ua) && /chrome/.test(ua)) return "chrome-android";
  return "other";
}

/**
 * Android-only deep link into the system Location settings.
 * There is NO iOS equivalent reachable from the web — iOS always needs
 * manual steps (Settings app), which the overlay renders instead.
 */
export const ANDROID_LOCATION_SETTINGS_INTENT =
  "intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end";
