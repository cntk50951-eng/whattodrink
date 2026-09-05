import type { ReactElement } from "react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { DrinkMap } from "@/components/map/DrinkMap";

/**
 * UR1.1 homepage map section (server component).
 * Heading + <DrinkMap /> (client). The map is the homepage protagonist —
 * since UR1.7 it stands alone: no hero, no Bento below it.
 */
export async function DrinkMapSection({
  pickOpen = false,
}: {
  /** `?pick=1` deep-link: reproduce the fan-pick end state on arrival. */
  pickOpen?: boolean;
}): Promise<ReactElement> {
  const t = await getTranslations("map");

  return (
    <section aria-label={t("mapLabel")}>
      {/* UR1.3 immersive: no heading block — the title floats on the map
          and every pixel of the first viewport goes to it. */}
      <Container className="pt-3 pb-10 md:pb-16">
        <DrinkMap initialPickOpen={pickOpen} />
        <p className="text-muted-foreground mt-3 text-xs md:text-sm">
          {t("mockNote")}
        </p>
      </Container>
    </section>
  );
}
