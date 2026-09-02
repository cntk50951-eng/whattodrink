"use client";

import { Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { ThemePreviewCard } from "@/components/theme-preview-card";
import { cn } from "@/lib/utils";

/**
 * Per UR 1.2 AC3: the same trigger renders an anchored Popover on desktop
 * (md+) and a bottom-anchored Sheet on mobile (<md). Tailwind's responsive
 * helpers hide whichever variant isn't appropriate — both share the same
 * global theme state from `useTheme()` so selections are instantly reflected
 * in either view.
 *
 * Accessibility (UR 1.2 §A11y):
 *   - Popover: focus moves into the popup on open and returns to trigger on close
 *     (base-ui Popover handles this by default).
 *   - Sheet: explicit Close button + backdrop click + the bottom-sheet default
 *     supports drag-to-close (gesture) via base-ui's SwipeArea on Popup.
 */
export function ThemeSwitcher() {
  const { theme, themeId, setThemeId, available } = useTheme();
  const t = useTranslations("theme");

  function handleSelect(id: string) {
    setThemeId(id);
  }

  return (
    <>
      {/* Desktop: anchored Popover */}
      <Popover>
        <PopoverTrigger
          className={cn(
            "hidden md:inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium",
            "hover:bg-muted transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
          aria-label={t("label")}
        >
          <span
            className="inline-block size-4 shrink-0 rounded-full border"
            style={{ backgroundColor: "var(--primary)", borderColor: "var(--border)" }}
            aria-hidden
          />
          <Palette className="size-4 text-muted-foreground" aria-hidden />
          <span>{t("options." + themeId)}</span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80"
        >
          <div className="px-1 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("label")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {available.map((th) => (
              <ThemePreviewCard
                key={th.id}
                theme={th}
                selected={themeId === th.id}
                onSelect={() => handleSelect(th.id)}
                compact
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Mobile: bottom Sheet */}
      <Sheet>
        <SheetTrigger
          className={cn(
            "md:hidden inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium",
            "hover:bg-muted transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
          aria-label={t("label")}
        >
          <span
            className="inline-block size-4 shrink-0 rounded-full border"
            style={{ backgroundColor: "var(--primary)", borderColor: "var(--border)" }}
            aria-hidden
          />
          <Palette className="size-4 text-muted-foreground" aria-hidden />
          <span>{t("options." + themeId)}</span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-8"
          showCloseButton
        >
          <SheetHeader>
            <SheetTitle>{t("label")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("label")}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {available.map((th) => (
              <ThemePreviewCard
                key={th.id}
                theme={th}
                selected={themeId === th.id}
                onSelect={() => handleSelect(th.id)}
                compact
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}