import { BentoGrid } from "@/components/marketing/bento/bento-grid";

/**
 * Marketing landing — anonymous visitor entry point (UR 1.1).
 *
 * Bento Grid with 3 cards:
 *   - Random Pick (main, in-place expand)
 *   - Photo Pick (secondary → /camera)
 *   - Mood Recommend (secondary → /mood)
 *
 * All text via next-intl, all styles via theme tokens.
 */
export default function MarketingHome() {
  return <BentoGrid />;
}