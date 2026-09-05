import { BentoGrid } from "@/components/marketing/bento/bento-grid";
import { Hero } from "@/components/marketing/hero";
import { DrinkMapSection } from "@/components/map/DrinkMapSection";

/**
 * Marketing landing — anonymous visitor entry point (UR 1.1 rewrite).
 *
 * UR1.1 new direction: the homepage IS the live drink map (protagonist).
 * Slim hero keeps the title + brand, the map follows immediately with the
 * random-pick entry embedded, and the Bento demo cards move below.
 */
export default function MarketingHome() {
  return (
    <>
      <Hero variant="slim" />
      <DrinkMapSection />
      <div id="cards" className="scroll-mt-20">
        <BentoGrid />
      </div>
    </>
  );
}
