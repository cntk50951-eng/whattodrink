import { BentoGrid } from "@/components/marketing/bento/bento-grid";
import { Hero } from "@/components/marketing/hero";

/**
 * Marketing landing — anonymous visitor entry point (UR 1.1, UR1.5).
 *
 * Doodle hero + Bento Grid with 3 cards:
 *   - Random Pick (main, in-place expand)
 *   - Photo Pick (secondary → /camera)
 *   - Mood Recommend (secondary → /mood)
 *
 * All text via next-intl, all styles via theme tokens (UR1.5 AC3).
 */
export default function MarketingHome() {
  return (
    <>
      <Hero />
      <div id="cards" className="scroll-mt-20">
        <BentoGrid />
      </div>
    </>
  );
}