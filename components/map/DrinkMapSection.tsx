import type { ReactElement } from "react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { DrinkMap } from "@/components/map/DrinkMap";

/**
 * UR1.1 homepage map section (server component).
 * Heading + <DrinkMap /> (client). The map is the homepage protagonist —
 * page.tsx renders this right under the slim hero, above the Bento grid.
 */
export async function DrinkMapSection(): Promise<ReactElement> {
  const t = await getTranslations("map");
  const stadiaMissing =
    (process.env.NEXT_PUBLIC_STADIA_KEY ?? "").trim().length === 0;

  return (
    <section aria-label={t("mapLabel")}>
      <Container className="pb-10 md:pb-16">
        <div className="mb-4 max-w-prose">
          <p className="font-hand text-lg text-(--doodle-red) md:text-xl">
            {t("badge")}
          </p>
          <h2 className="font-hand mt-1 text-3xl leading-tight font-bold text-balance md:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">
            {t("subtitle")}
          </p>
        </div>
        <DrinkMap />
        <p className="text-muted-foreground mt-3 text-xs md:text-sm">
          {t("mockNote")}
        </p>
        {stadiaMissing ? (
          <p className="text-muted-foreground mt-1 text-xs md:text-sm">
            {t("tilesFallback")}
          </p>
        ) : null}
      </Container>
    </section>
  );
}
