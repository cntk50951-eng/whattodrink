import { DrinkMapSection } from "@/components/map/DrinkMapSection";

/**
 * Marketing landing — anonymous visitor entry point (UR1.1 rewrite, UR1.3).
 *
 * UR1.3 immersive mobile: the slim hero is retired from the home page —
 * its title lives on as a floating bar inside the map, and the map takes
 * the full first viewport under the header.
 * UR1.7: the map stands alone — BentoGrid is deleted, its three entries
 * moved to the header menu. `?pick=1` deep-links the full pick end-state
 * (fly home + fan + sheet), same as tapping the fan entry by hand.
 */
export default async function MarketingHome({
  searchParams,
}: {
  searchParams: Promise<{ pick?: string }>;
}) {
  const { pick } = await searchParams;
  return (
    <>
      <DrinkMapSection pickOpen={pick === "1"} />
    </>
  );
}
