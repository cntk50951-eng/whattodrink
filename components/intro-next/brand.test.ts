import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTRO_BRAND } from "./brand";
import { INTRO_COPY } from "./copy";

describe("official intro brand", () => {
  it("keeps hi drink lowercase and 嗨飲 unchanged in both Chinese locales", () => {
    expect(INTRO_BRAND.en).toBe("hi drink");
    expect(INTRO_BRAND.zh).toBe("嗨飲");
    for (const locale of ["zh-Hant", "zh-Hans", "en"] as const) {
      const copy = INTRO_COPY[locale];
      expect(copy.title).toContain("hi drink");
      expect(copy.hero.eyebrow).toContain("hi drink");
      expect(copy.end.eyebrow).toContain("hi drink");
      expect(copy.title).not.toMatch(/WhatToDrink|嗨饮/);
      if (locale !== "en") expect(copy.hero.eyebrow).toContain("嗨飲");
    }
  });

  it("retains the approved logo and current outlined wordmarks byte for byte", () => {
    // Source hashes independently captured from the read-only, approved iOS POC.
    const approved = {
      "approved-logo-original.png": "85bce7d7cbfd72d63f4fb615fb5631bdb136c437b9d3ca3cdb0ec24c9a9df76a",
      "wordmark-en.svg": "dcab4649c1a766c7590f05ddc5f9d2281817ac831601564d263358dcff38ad05",
      "wordmark-zh.svg": "5ba48b64d55c7b49313b09ccd666f1b4657da13094d72dfa676576de8cafe987",
    };
    for (const [file, hash] of Object.entries(approved)) {
      const bytes = readFileSync(path.resolve("public/intro-next/brand", file));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    }
  });
});
