import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Direction = "col" | "row";
type Align = "start" | "center" | "end" | "stretch";
type Justify = "start" | "center" | "end" | "between";
type Gap = "0" | "1" | "2" | "3" | "4" | "6" | "8" | "10" | "12";

/**
 * Responsive variant helper: accept either a single value (applies at all
 * breakpoints) or an object keyed by breakpoint (only those breakpoints
 * are emitted; smaller breakpoints inherit via Tailwind's responsive system
 * since missing keys leave no class behind).
 */
type Responsive<T extends string> = T | Partial<Record<"base" | "md" | "lg", T>>;

function variantClass<T extends string>(
  prefix: string,
  value: Responsive<T> | undefined,
  options: readonly T[],
): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    if (!options.includes(value)) {
      throw new Error(`Stack: invalid ${prefix} "${value}"`);
    }
    return [`${prefix}-${value}`];
  }
  const classes: string[] = [];
  for (const [bp, v] of Object.entries(value)) {
    if (v == null) continue;
    if (!options.includes(v as T)) {
      throw new Error(`Stack: invalid ${prefix} "${v}" at ${bp}`);
    }
    const cls = `${prefix}-${v}`;
    classes.push(bp === "base" ? cls : `${bp}:${cls}`);
  }
  return classes;
}

/**
 * Flexbox column or row with consistent gap. Token-driven spacing via Tailwind's
 * gap scale so it composes with the rest of the system.
 *
 * Every prop (direction / gap / align / justify) accepts either a single value
 * or a responsive object: `{ base?, md?, lg? }`. Missing keys emit no class,
 * letting Tailwind's mobile-first cascade handle inheritance.
 */
export function Stack({
  children,
  direction = "col",
  gap = "4",
  align,
  justify,
  className,
}: {
  children: ReactNode;
  direction?: Responsive<Direction>;
  gap?: Responsive<Gap>;
  align?: Responsive<Align>;
  justify?: Responsive<Justify>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // min-w-0 lets flex children shrink below their min-content size,
        // which is what allows long Chinese titles / unbreakable strings
        // to wrap instead of pushing the column wider than its parent.
        "flex min-w-0",
        ...variantClass("flex", direction, ["col", "row"] as const),
        // For responsive direction we need wrap behavior at row direction;
        // for the base single-value "col" case, no wrap class is added.
        ...variantClass("items", align, [
          "start",
          "center",
          "end",
          "stretch",
        ] as const),
        ...variantClass("justify", justify, [
          "start",
          "center",
          "end",
          "between",
        ] as const),
        ...variantClass("gap", gap, [
          "0",
          "1",
          "2",
          "3",
          "4",
          "6",
          "8",
          "10",
          "12",
        ] as const),
        // flex-wrap is only meaningful for row; emit at all breakpoints where
        // direction is row.
        ...(typeof direction === "string"
          ? direction === "row"
            ? ["flex-wrap"]
            : []
          : Object.values(direction).some((v) => v === "row")
            ? ["flex-wrap"]
            : []),
        className,
      )}
    >
      {children}
    </div>
  );
}
