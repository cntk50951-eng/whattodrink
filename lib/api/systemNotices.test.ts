import { describe, expect, it } from "vitest";
import {
  compareSemver,
  filterActiveNotices,
  isVersionBelow,
  normalizeNoticeLocale,
  parseAdminNoticeForm,
  sanitizeNoticeUrl,
  type RawSystemNoticeRow,
} from "./systemNotices";

describe("systemNotices 純邏輯", () => {
  it("compareSemver 與 isVersionBelow 正確比對版本門檻", () => {
    expect(compareSemver("1.4.2", "1.5.0")).toBe(-1);
    expect(compareSemver("v1.5.0", "1.5")).toBe(0);
    expect(compareSemver("1.10.0", "1.9.9")).toBe(1);
    expect(compareSemver("bad", "1.0.0")).toBeNull();

    expect(isVersionBelow("1.4.2", "1.5.0")).toBe(true);
    expect(isVersionBelow("1.5.0", "1.5.0")).toBe(false);
    expect(isVersionBelow("1.6.0", "1.5.0")).toBe(false);
    expect(isVersionBelow(null, "1.5.0")).toBe(false);
    expect(isVersionBelow(null, null)).toBe(true);
  });

  it("normalizeNoticeLocale 與 sanitizeNoticeUrl 嚴格白名單", () => {
    expect(normalizeNoticeLocale("zh-HK")).toBe("zh-Hant");
    expect(normalizeNoticeLocale("zh-CN")).toBe("zh-Hans");
    expect(normalizeNoticeLocale("zh-Hans")).toBe("zh-Hans");
    expect(normalizeNoticeLocale("en-US")).toBe("en");

    expect(sanitizeNoticeUrl("https://apps.apple.com/app/id123")).toBe("https://apps.apple.com/app/id123");
    expect(sanitizeNoticeUrl("itms-apps://itunes.apple.com/app/id123")).toBe("itms-apps://itunes.apple.com/app/id123");
    expect(sanitizeNoticeUrl("market://details?id=hk.whattodrink.app")).toBe("market://details?id=hk.whattodrink.app");
    expect(sanitizeNoticeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeNoticeUrl("http://insecure.example")).toBeNull();
  });

  it("filterActiveNotices 過濾平台、版本、時間窗並優先排列 force", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const rows: RawSystemNoticeRow[] = [
      {
        id: "draft-1",
        kind: "announcement",
        severity: "normal",
        platforms: ["ios", "android"],
        title_zh_hant: "草稿",
        published: false,
        starts_at: "2026-11-20T00:00:00Z",
      },
      {
        id: "expired-1",
        kind: "maintenance",
        severity: "normal",
        platforms: ["ios"],
        title_zh_hant: "已過期",
        published: true,
        starts_at: "2026-11-10T00:00:00Z",
        ends_at: "2026-11-21T00:00:00Z",
      },
      {
        id: "android-only",
        kind: "update",
        severity: "normal",
        platforms: ["android"],
        title_zh_hant: "Android 更新",
        published: true,
        starts_at: "2026-11-22T00:00:00Z",
      },
      {
        id: "normal-new",
        kind: "announcement",
        severity: "normal",
        platforms: ["ios", "android"],
        title_zh_hant: "新活動",
        title_en: "New Event",
        body_zh_hant: "繁體正文",
        body_en: "English body",
        bullets: [{ icon: "🍻", title_zh_hant: "亮點一", title_en: "Highlight 1", desc_zh_hant: "說明", desc_en: "Desc" }],
        published: true,
        starts_at: "2026-11-22T10:00:00Z",
      },
      {
        id: "force-upgrade",
        kind: "update",
        severity: "force",
        platforms: ["ios", "android"],
        max_version: "1.5.0",
        version_label: "v1.5.0",
        title_zh_hant: "請升級",
        title_en: "Please Upgrade",
        published: true,
        starts_at: "2026-11-21T00:00:00Z",
      },
    ];

    const forOldIos = filterActiveNotices(rows, { platform: "ios", version: "1.4.2", locale: "en", nowMs: now });
    expect(forOldIos.map((n) => n.id)).toEqual(["force-upgrade", "normal-new"]);
    expect(forOldIos[0]?.title).toBe("Please Upgrade");
    expect(forOldIos[1]?.bullets).toEqual([{ icon: "🍻", title: "Highlight 1", desc: "Desc" }]);

    // 已升級至 1.5.0 的用戶自動不再收到 max_version=1.5.0 的更新通知
    const forNewIos = filterActiveNotices(rows, { platform: "ios", version: "1.5.0", locale: "zh-Hant", nowMs: now });
    expect(forNewIos.map((n) => n.id)).toEqual(["normal-new"]);
  });

  it("parseAdminNoticeForm 校驗必填欄位、URL 與時間窗", () => {
    const bad = new FormData();
    bad.set("title_zh_hant", "測試");
    expect(parseAdminNoticeForm(bad).ok).toBe(false);

    const good = new FormData();
    good.set("kind", "update");
    good.set("severity", "normal");
    good.set("platform_ios", "on");
    good.set("platform_android", "on");
    good.set("max_version", "1.5.0");
    good.set("version_label", "v1.5.0");
    good.set("title_zh_hant", "Hi Drink v1.5 上線");
    good.set("body_zh_hant", "全新聊天撤回與極速地圖。");
    good.set("b1_icon", "💬");
    good.set("b1_title_zh_hant", "訊息撤回");
    good.set("b1_desc_zh_hant", "48 小時內可為所有人撤回");
    good.set("cta_url", "https://apps.apple.com/app/id123");
    good.set("published", "on");
    const parsed = parseAdminNoticeForm(good);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.platforms).toEqual(["ios", "android"]);
      expect(parsed.data.bullets).toHaveLength(1);
      expect(parsed.data.published).toBe(true);
    }
  });
});
