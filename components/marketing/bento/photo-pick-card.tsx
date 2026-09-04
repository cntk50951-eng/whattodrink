import Link from "next/link";
import { Camera } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Secondary Bento card — click navigates to /camera (full-screen flow that
 * needs camera permissions; per UR 1.1, secondary cards don't expand in place).
 */
export async function PhotoPickCard({ className }: { className?: string }) {
  const t = await getTranslations("bento.photoPick");

  return (
    <Link
      href="/camera"
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 bg-secondary text-secondary-foreground",
        "p-6 md:p-8 flex flex-col justify-between",
        "transition-colors hover:border-primary motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform",
        className,
      )}
      data-card="photo-pick"
    >
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {t("eyebrow")}
        </span>
        <h3 className="text-2xl md:text-3xl lg:text-4xl font-hand font-bold tracking-tight text-balance">
          {t("title")}
        </h3>
        <p className="text-sm md:text-base text-muted-foreground text-pretty">
          {t("description")}
        </p>
      </div>
      <div aria-hidden className="pointer-events-none select-none">
        <svg viewBox="0 0 120 90" width="100%" className="max-h-24">
          <g
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Phone */}
            <rect
              x="40"
              y="8"
              width="40"
              height="74"
              rx="7"
              fill="var(--card)"
            />
            {/* Screen */}
            <rect
              x="45"
              y="20"
              width="30"
              height="42"
              fill="var(--secondary)"
              strokeWidth="1.5"
            />
            {/* Lens */}
            <circle
              cx="60"
              cy="41"
              r="9"
              fill="var(--card)"
              strokeWidth="1.5"
            />
            <circle cx="60" cy="41" r="3.5" fill="var(--doodle-red)" stroke="none" />
            {/* Flash + speaker */}
            <circle cx="72" cy="26" r="2" fill="var(--primary)" stroke="none" />
            <line x1="55" y1="13" x2="65" y2="13" strokeWidth="1.5" />
            {/* Scan corners */}
            <g stroke="var(--primary)" strokeWidth="2">
              <path d="M48 24 L48 20 L52 20" />
              <path d="M68 20 L72 20 L72 24" />
              <path d="M48 58 L48 62 L52 62" />
              <path d="M68 62 L72 62 L72 58" />
            </g>
          </g>
        </svg>
      </div>
      <div className="flex items-center justify-between pt-6">
        <span className="inline-flex items-center justify-center size-10 rounded-xl bg-card text-card-foreground border-2">
          <Camera className="size-5" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">
          {t("eyebrow")} →
        </span>
      </div>
    </Link>
  );
}