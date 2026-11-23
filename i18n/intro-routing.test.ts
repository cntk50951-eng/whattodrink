import { describe, expect, it } from "vitest";

import { introRouting, isIntroRoute } from "./intro-routing";
import { routing } from "./routing";

describe("intro locale policy", () => {
  it("applies the default policy to every supported intro URL", () => {
    for (const page of ["/intro", "/intro-next", "/intro/artwork", "/intro-next/artwork"]) {
      expect(isIntroRoute(page)).toBe(true);
      for (const locale of routing.locales) {
        expect(isIntroRoute(`/${locale}${page}`)).toBe(true);
        expect(isIntroRoute(`/${locale}${page}/`)).toBe(true);
      }
    }
  });
  it("disables intro negotiation while retaining explicit three-language routes", () => {
    expect(introRouting.defaultLocale).toBe("zh-Hant");
    expect(introRouting.localeDetection).toBe(false);
    expect(introRouting.localePrefix).toBe("as-needed");
    expect(introRouting.locales).toEqual(["zh-Hant", "zh-Hans", "en"]);
    expect(routing).not.toHaveProperty("localeDetection");
  });
  it("isolates the policy from app routes, original backup and unrelated paths", () => {
    for (const page of ["/intro", "/intro/", "/en/intro", "/zh-Hans/intro-next/artwork"]) expect(isIntroRoute(page)).toBe(true);
    for (const page of ["/", "/v2", "/en/v2", "/intro-backup", "/en/intro-backup", "/intro-extra", "/intro/settings"]) expect(isIntroRoute(page)).toBe(false);
  });
});
