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
        "group relative overflow-hidden rounded-2xl border bg-card text-card-foreground",
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
            <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-heading font-semibold tracking-tight text-balance">
              {t("title")}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-prose text-pretty">
              {t("description")}
            </p>
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