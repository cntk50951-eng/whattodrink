import { describe, expect, it } from "vitest";

import { ARTWORK_SCREENS } from "./artwork";
import { INTRO_COPY, introHref, introLanguageHref } from "./copy";

describe("introHref", () => {
  it("uses the unprefixed default and explicit alternative locales", () => {
    expect(introHref("zh-Hant")).toBe("/intro-next");
    expect(introHref("zh-Hans")).toBe("/zh-Hans/intro-next");
    expect(introHref("en")).toBe("/en/intro-next");
  });
  it("links back to the original with the selected locale", () => {
    expect(introHref("zh-Hant", "intro")).toBe("/intro");
    expect(introHref("zh-Hans", "intro")).toBe("/zh-Hans/intro");
    expect(introHref("en", "intro")).toBe("/en/intro");
  });
});

describe("intro content coverage", () => {
  it("introduces posts and Ivy games in the opening of every language", () => {
    for (const copy of Object.values(INTRO_COPY)) {
      expect(copy.hero.sub).toContain("Ivy");
      expect(copy.description).toMatch(/發帖|发帖|photo posts/);
      expect(copy.description).toMatch(/大話骰|大话骰|Liar’s Dice/);
      expect(copy.screenshotNote).toMatch(/示範內容|示例内容|Demo content/);
    }
  });
});

describe("language switching overrides the previous locale cookie", () => {
  it("explicitly names all locales on both story and gallery routes", () => {
    for (const locale of ["zh-Hant", "zh-Hans", "en"] as const) {
      expect(introLanguageHref(locale)).toBe(`/${locale}/intro-next`);
      expect(introLanguageHref(locale, "intro-next/artwork")).toBe(`/${locale}/intro-next/artwork`);
    }
  });
  it("keeps published language and gallery links on the published route", () => {
    for (const locale of ["zh-Hant", "zh-Hans", "en"] as const) {
      expect(introLanguageHref(locale, "intro")).toBe(`/${locale}/intro`);
      expect(introLanguageHref(locale, "intro/artwork")).toBe(`/${locale}/intro/artwork`);
      const prefix = locale === "zh-Hant" ? "" : `/${locale}`;
      expect(introHref(locale, "intro/artwork")).toBe(`${prefix}/intro/artwork`);
      expect(introHref(locale, "intro-backup")).toBe(`${prefix}/intro-backup`);
      expect(introHref(locale, "intro-backup")).not.toBe(introHref(locale, "intro"));
    }
  });
});

describe("unnumbered marketing copy", () => {
  it("removes sequence numbers from scene headings and every localized artwork caption", () => {
    for (const copy of Object.values(INTRO_COPY)) for (const scene of Object.values(copy.scenes)) {
      expect(scene.eyebrow).not.toMatch(/\/\s*0\d/);
    }
    for (const screen of ARTWORK_SCREENS) for (const label of Object.values(screen.label)) {
      expect(label).not.toMatch(/^\d+\s*[·.]/);
    }
  });
});
