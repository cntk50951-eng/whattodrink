"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/themes/types";

/**
 * Visual preview swatch for a theme. Renders a self-contained card that
 * applies the theme's CSS variables locally — so the preview accurately
 * reflects what the theme looks like regardless of which theme is
 * currently active globally.
 *
 * Per UR 1.2 AC4: each card shows a recognizable visual thumbnail +
 * clear selection indicator (border + check).
 */
export function ThemePreviewCard({
  theme,
  selected,
  onSelect,
  compact = false,
}: {
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  /** compact=true → smaller swatch, used in tight Popover rows */
  compact?: boolean;
}) {
  const t = useTranslations("theme");

  // Apply this theme's tokens locally so the preview renders in its own style.
  const localVars = theme.tokens as Record<string, string>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-background text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-foreground/40",
      )}
    >
      {/* Thumbnail: a mini "card-on-card" preview using this theme's tokens */}
      <div
        style={localVars}
        className={cn(
          "relative overflow-hidden rounded-t-[10px] border-b bg-background",
          compact ? "h-16" : "h-24",
        )}
      >
        <div className="absolute inset-2 flex flex-col gap-1.5">
          <div
            className="h-2.5 w-1/2 rounded-full"
            style={{ backgroundColor: "var(--foreground)" }}
          />
          <div
            className="h-1.5 w-3/4 rounded-full opacity-60"
            style={{ backgroundColor: "var(--muted-foreground)" }}
          />
          <div className="mt-auto flex gap-1.5">
            <div
              className="h-4 w-10 rounded"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <div
              className="h-4 w-10 rounded border"
              style={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
              }}
            />
          </div>
        </div>
        {selected && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="size-3.5" />
          </div>
        )}
      </div>

      {/* Label row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card">
        <span
          className="inline-block size-3 shrink-0 rounded-full border"
          style={{ backgroundColor: "var(--primary)", borderColor: "var(--border)" }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">
            {t("options." + theme.id)}
          </div>
          {!compact && theme.description && (
            <div className="truncate text-[10px] text-muted-foreground">
              {theme.description}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}