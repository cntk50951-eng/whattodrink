import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { BeerMugDoodle } from "@/components/marketing/BeerMugDoodle";

type HeroProps = {
  /**
   * UR1.1 homepage: the map is the protagonist, so the home hero renders
   * "slim" (title only — the beer art moves to the map card corner).
   * "full" keeps the original UR1.5 hero for any other use.
   */
  variant?: "full" | "slim";
};

/**
 * UR1.5 homepage hero — doodle look per 07-hand-drawn-doodle.html.
 *
 * Procedural mini doodle lives in BeerMugDoodle so it follows theme tokens
 * via CSS vars — no hardcoded colors (AC3).
 */
export async function Hero({ variant = "full" }: HeroProps) {
  const t = await getTranslations("hero");
  const slim = variant === "slim";

  return (
    <section aria-label={t("title")}>
      <Container className={slim ? "py-6 md:py-8" : "py-10 md:py-16"}>
        {slim ? (
          <div className="max-w-prose">
            <p className="font-hand text-lg text-(--doodle-red) md:text-xl">
              {t("eyebrow")}
            </p>
            <h1 className="font-hand mt-1 text-4xl leading-none font-bold tracking-tight text-balance md:text-5xl">
              {t("title")}
            </h1>
            <svg
              viewBox="0 0 200 12"
              className="mt-2 w-36 md:w-44"
              aria-hidden
            >
              <path
                d="M4 8 Q 30 2 55 7 T 106 7 T 157 7 T 196 6"
                fill="none"
                stroke="var(--doodle-red)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="font-hand text-xl text-(--doodle-red) md:text-2xl">
                {t("eyebrow")}
              </p>
              <h1 className="font-hand mt-2 text-6xl leading-none font-bold tracking-tight text-balance md:text-8xl">
                {t("title")}
              </h1>
              <svg
                viewBox="0 0 200 12"
                className="mt-2 w-44 md:w-56"
                aria-hidden
              >
                <path
                  d="M4 8 Q 30 2 55 7 T 106 7 T 157 7 T 196 6"
                  fill="none"
                  stroke="var(--doodle-red)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-muted-foreground mt-4 max-w-prose text-base md:text-lg">
                {t("subtitle")}
              </p>
              <div className="mt-6">
                <Button
                  size="lg"
                  nativeButton={false}
                  render={<a href="#cards" />}
                >
                  {t("cta")}
                </Button>
              </div>
            </div>

            <div aria-hidden className="mx-auto w-full max-w-md">
              <BeerMugDoodle cheersLabel={t("cheers")} />
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
