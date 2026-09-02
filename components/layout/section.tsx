import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "./container";

/**
 * Vertical section with optional muted background.
 * Mobile-first vertical rhythm: py-12 → md:py-16 → lg:py-24.
 *
 * Layout primitives follow UR 1.0 (auto-fit mobile/desktop).
 */
export function Section({
  children,
  className,
  containerSize = "default",
  tone = "default",
  as: Tag = "section",
  id,
}: {
  children: ReactNode;
  className?: string;
  containerSize?: "default" | "narrow" | "wide";
  tone?: "default" | "muted";
  as?: "section" | "div" | "article" | "aside";
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "py-12 md:py-16 lg:py-24",
        tone === "muted" && "bg-muted/40",
        className,
      )}
    >
      <Container size={containerSize}>{children}</Container>
    </Tag>
  );
}
