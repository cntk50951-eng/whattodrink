import { Section } from "@/components/layout/section";
import { RandomPickCard } from "./random-pick-card";
import { PhotoPickCard } from "./photo-pick-card";
import { MoodRecCard } from "./mood-rec-card";

/**
 * Bento Grid — asymmetric card layout per UR 1.1.
 *
 * - Desktop (lg+): 4-column grid. Main card spans 2 cols × 2 rows on the
 *   left; secondary cards stack on the right at 2 cols × 1 row each.
 * - Tablet (md): 2-column grid. Main card on top spanning full width;
 *   secondaries side by side below.
 * - Mobile (base): single column, natural top-down order.
 *
 * DOM order (RandomPick → PhotoPick → MoodRec) matches visual order so
 * screen readers / keyboard tab follows the expected reading flow.
 *
 * All cards read colors from semantic theme tokens — no hardcoded values —
 * so theme switching updates every card's surface, border, and accent instantly.
 */
export function BentoGrid() {
  return (
    <Section>
      <div
        className="grid gap-4 md:gap-5
                   grid-cols-1
                   md:grid-cols-2 md:grid-rows-[auto_auto_auto]
                   lg:grid-cols-4 lg:grid-rows-2
                   lg:auto-rows-[minmax(0,1fr)]"
      >
        {/* Main card: spans the left half (2×2) on desktop, full top row on tablet */}
        <RandomPickCard
          className="
            md:col-span-2
            lg:col-start-1 lg:col-span-2
            lg:row-start-1 lg:row-span-2
          "
        />
        {/* Secondary cards: stack on the right at desktop, side-by-side on tablet */}
        <PhotoPickCard
          className="
            md:col-span-1
            lg:col-start-3 lg:col-span-2
            lg:row-start-1 lg:row-span-1
          "
        />
        <MoodRecCard
          className="
            md:col-span-1
            lg:col-start-3 lg:col-span-2
            lg:row-start-2 lg:row-span-1
          "
        />
      </div>
    </Section>
  );
}