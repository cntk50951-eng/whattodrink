import { defineRouting } from "next-intl/routing";

/**
 * Centralised locale configuration. To add a new language:
 *   1. Add the locale code to `locales` below
 *   2. Create `messages/<locale>.json` with translations
 *   3. Add a label entry to `localeLabels` in components/language-picker.tsx
 *
 * `localePrefix: 'never'` keeps URLs unprefixed (e.g. `/bars` not
 * `/zh-Hant/bars`). Works because we have the `[locale]` dynamic segment
 * in the route tree — the proxy can rewrite internally without breaking
 * route resolution.
 */
export const routing = defineRouting({
  locales: ["zh-Hant", "zh-Hans", "en"],
  defaultLocale: "zh-Hant",
  localePrefix: "never",
});

export type AppLocale = (typeof routing.locales)[number];