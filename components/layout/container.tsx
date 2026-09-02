import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Centered, max-width wrapper that adapts across breakpoints.
 * Mobile: full width with edge padding.
 * md+: capped at max-w-screen-xl with comfortable gutters.
 *
 * Theme-agnostic — only uses semantic CSS variables via Tailwind tokens.
 */
export function Container({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        size === "narrow" && "max-w-3xl",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-screen-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
