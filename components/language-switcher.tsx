"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_COOKIE = "NEXT_LOCALE";

// Short native-script labels keep the segmented control compact.
// Tooltips / aria-label fall back to the full i18n key for screen readers.
const LOCALE_LABEL: Record<AppLocale, string> = {
  "zh-Hant": "繁",
  "zh-Hans": "简",
  en: "EN",
};

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/**
 * Per UR 1.2 AC1: language switcher is a persistent segmented control
 * (always visible, no dropdown). Each option is a real <button> with
 * `aria-pressed` for state. Keyboard: focus moves naturally between
 * buttons; arrow keys are optional (Tab + Enter / Space is the universal
 * baseline).
 *
 * UR 1.2 AC2 (collapse when >4 locales): not triggered yet — currently
 * 3 locales. Architecture: wrap the options in a "+ more" popover if
 * `routing.locales.length > 4`.
 */
export function LanguageSwitcher() {
  const t = useTranslations("language");
  const current = useLocale() as AppLocale;
  const [isPending, startTransition] = useTransition();

  function selectLocale(locale: AppLocale) {
    if (locale === current) return;
    setLocaleCookie(locale);
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center rounded-full border bg-card p-0.5",
        "text-xs sm:text-sm",
        isPending && "opacity-60 pointer-events-none",
      )}
    >
      {routing.locales.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={active}
            aria-label={t("options." + locale)}
            onClick={() => selectLocale(locale)}
            className={cn(
              "min-w-8 px-2.5 py-1 rounded-full font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
}