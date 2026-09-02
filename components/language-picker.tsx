"use client";

import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_COOKIE = "NEXT_LOCALE";

function setLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/**
 * Switches the active locale by setting the next-intl cookie and reloading.
 * Reload is fine: locale switching is rare and the page is statically prerendered.
 */
export function LanguagePicker() {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-2",
        )}
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">
          {t("options." + current)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {routing.locales.map((locale) => (
            <DropdownMenuItem
              key={locale}
              onSelect={() => selectLocale(locale)}
              disabled={locale === current}
            >
              <span className="flex w-full items-center justify-between">
                <span>{t("options." + locale)}</span>
                {locale === current && <Check className="size-4" />}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}