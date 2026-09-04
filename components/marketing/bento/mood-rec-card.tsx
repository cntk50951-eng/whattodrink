import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

/**
 * Secondary Bento card — click navigates to /mood (input flow; per UR 1.1
 * secondary cards don't expand in place because they need real input UI).
 */
export async function MoodRecCard({ className }: { className?: string }) {
  const t = await getTranslations("bento.moodRecommend");

  return (
    <Link
      href="/mood"
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 bg-accent text-accent-foreground",
        "p-6 md:p-8 flex flex-col justify-between",
        "transition-colors hover:border-primary motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform",
        className,
      )}
      data-card="mood-rec"
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
            {/* Thought bubble */}
            <path
              d="M22 42 Q 22 16 60 16 Q 98 16 98 42 Q 98 64 60 64 L48 64 L40 74 L43 64 Q 22 64 22 42 Z"
              fill="var(--card)"
            />
            <circle cx="34" cy="78" r="3.5" fill="var(--card)" strokeWidth="1.5" />
            {/* Heart in bubble */}
            <path
              d="M60 50 Q 52 40 60 38 Q 64 38 66 42 Q 68 38 72 38 Q 80 40 72 50 Q 68 54 66 55 Q 64 54 60 50 Z"
              fill="var(--accent)"
              strokeWidth="1.5"
            />
            {/* Mood dots */}
            <circle cx="16" cy="22" r="2.5" fill="var(--primary)" stroke="none" />
            <circle cx="104" cy="24" r="2.5" fill="var(--secondary)" stroke="none" />
          </g>
        </svg>
      </div>
      <div className="flex items-center justify-between pt-6">
        <span className="inline-flex items-center justify-center size-10 rounded-xl bg-card text-card-foreground border-2">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">
          {t("eyebrow")} →
        </span>
      </div>
    </Link>
  );
}