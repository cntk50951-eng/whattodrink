"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Beer } from "@/lib/beers";
import { pickRandomBeer } from "@/lib/beers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "idle" | "loading" | "result" | "timeout";

/**
 * Main Bento card — in-place expand on click. No navigation, no login required.
 *
 * State machine:
 *   idle    → click CTA → loading (1.2s) → result
 *   result  → click Try again → loading (1.2s) → result
 *   loading → 3s without result → timeout (UR 1.1 edge case)
 *
 * Respect prefers-reduced-motion: animations are disabled in CSS via
 * `motion-safe:` variants.
 */
export function RandomPickCard({ className }: { className?: string }) {
  const t = useTranslations("bento.randomPick");
  const [phase, setPhase] = useState<Phase>("idle");
  const [beer, setBeer] = useState<Beer | null>(null);
  const [, startTransition] = useTransition();

  function handleClick() {
    setBeer(null);
    setPhase("loading");

    // Timeout fallback for the UR edge case (network unreliable etc.)
    const timeout = window.setTimeout(() => {
      setPhase((p) => (p === "loading" ? "timeout" : p));
    }, 3000);

    // Simulated async work — replace with real API call once Supabase lands.
    window.setTimeout(() => {
      window.clearTimeout(timeout);
      const picked = pickRandomBeer();
      startTransition(() => {
        setBeer(picked);
      setPhase("result");
      });
    }, 1200);
  }

  function reset() {
    setPhase("idle");
    setBeer(null);
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 bg-card text-card-foreground",
        "p-6 md:p-8 lg:p-10 flex flex-col justify-between",
        "transition-colors hover:border-primary motion-safe:hover:-translate-y-0.5 motion-safe:transition-transform",
        className,
      )}
      data-card="random-pick"
    >
      {phase === "idle" && (
        <div className="flex h-full flex-col justify-between gap-8">
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {t("eyebrow")}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-hand font-bold tracking-tight text-balance">
              {t("title")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-prose text-pretty">
              {t("description")}
            </p>
          </div>
          <div
            aria-hidden
            className="pointer-events-none select-none"
          >
            <svg viewBox="0 0 200 90" width="100%" className="max-h-28">
              <g
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Bottle */}
                <path
                  d="M30 18 L30 28 Q24 28 24 34 L24 76 Q24 82 30 82 L54 82 Q60 82 60 76 L60 34 Q60 28 54 28 L54 18 Z"
                  fill="var(--card)"
                />
                <rect
                  x="28"
                  y="46"
                  width="28"
                  height="16"
                  fill="var(--doodle-red)"
                />
                {/* Glass */}
                <path
                  d="M110 34 L105 80 L145 80 L140 34 Z"
                  fill="var(--card)"
                />
                <path
                  d="M108 44 L107 78 L143 78 L142 44 Z"
                  fill="var(--primary)"
                  strokeWidth="1.5"
                />
                {/* Foam */}
                <path
                  d="M106 34 Q 105 24 116 23 Q 123 16 132 24 Q 141 20 144 34 Z"
                  fill="var(--card)"
                />
                {/* Arrow */}
                <path d="M70 52 L96 52 M90 47 L97 52 L90 57" />
                {/* Bubbles */}
                <circle cx="160" cy="30" r="4" fill="var(--accent)" stroke="none" />
                <circle cx="172" cy="48" r="3" fill="var(--secondary)" stroke="none" />
                <circle
                  cx="162"
                  cy="66"
                  r="5"
                  strokeWidth="1.5"
                />
              </g>
            </svg>
          </div>
          <div>
            <Button size="lg" onClick={handleClick}>
              {t("cta")}
            </Button>
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex h-full flex-col items-center justify-center text-center gap-4 motion-safe:animate-pulse">
          <span className="text-6xl md:text-7xl" aria-hidden>
            🎲
          </span>
          <p className="text-base md:text-lg text-muted-foreground">
            {t("loadingDrink")}
          </p>
        </div>
      )}

      {phase === "result" && beer && (
        <div className="flex h-full flex-col items-center justify-center text-center gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {t("resultTitle")}
          </span>
          <span className="text-7xl md:text-8xl" aria-hidden>
            {beer.emoji}
          </span>
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold break-words">
            {beer.name}
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("resultSubtitle")} · {beer.tagline}
          </p>
          <Button size="sm" variant="outline" onClick={reset}>
            {t("tryAgain")}
          </Button>
        </div>
      )}

      {phase === "timeout" && (
        <div className="flex h-full flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl md:text-7xl" aria-hidden>
            🌀
          </span>
          <p className="text-base md:text-lg text-muted-foreground max-w-prose">
            {t("timeoutMessage")}
          </p>
          <Button size="sm" variant="outline" onClick={reset}>
            {t("tryAgain")}
          </Button>
        </div>
      )}
    </article>
  );
}