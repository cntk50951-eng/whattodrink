import { BentoGrid } from "@/components/marketing/bento/bento-grid";
import { DrinkMapSection } from "@/components/map/DrinkMapSection";

/**
 * Marketing landing — anonymous visitor entry point (UR1.1 rewrite, UR1.3).
 *
 * UR1.3 immersive mobile: the slim hero is retired from the home page —
 * its title lives on as a floating bar inside the map, and the map takes
 * the full first viewport under the header. Bento follows below.
 */
export default function MarketingHome() {
  return (
    <>
      <DrinkMapSection />
      <div id="cards" className="scroll-mt-20">
        <BentoGrid />
      </div>
    </>
  );
}
