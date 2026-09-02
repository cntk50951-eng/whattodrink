import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive auto-fit grid. Mobile = 1 column; grows at md / lg breakpoints.
 * minChildWidth lets content dictate the column count for unknown item counts.
 */
export function Grid({
  children,
  cols = { base: 1, md: 2, lg: 3 },
  gap = "6",
  className,
}: {
  children: ReactNode;
  cols?: { base?: 1 | 2; md?: 1 | 2 | 3 | 4; lg?: 1 | 2 | 3 | 4 | 6 };
  gap?: "2" | "4" | "6" | "8";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid",
        cols.base === 2 && "grid-cols-2",
        cols.base === 1 && "grid-cols-1",
        cols.md === 2 && "md:grid-cols-2",
        cols.md === 3 && "md:grid-cols-3",
        cols.md === 4 && "md:grid-cols-4",
        cols.lg === 2 && "lg:grid-cols-2",
        cols.lg === 3 && "lg:grid-cols-3",
        cols.lg === 4 && "lg:grid-cols-4",
        cols.lg === 6 && "lg:grid-cols-6",
        `gap-${gap}`,
        className,
      )}
    >
      {children}
    </div>
  );
}
