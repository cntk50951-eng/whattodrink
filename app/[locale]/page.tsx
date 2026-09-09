import { CameraOverlay } from "@/components/camera/camera-overlay";
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
 * UR4.1 v6: `?shoot=1` 把拍照分享蓋成 overlay，地圖常駐底下（沿 pick 配方）。
 */
export default async function MarketingHome({
  searchParams,
}: {
  searchParams: Promise<{ pick?: string; shoot?: string }>;
}) {
  const { pick, shoot } = await searchParams;
  return (
    <>
      <DrinkMapSection pickOpen={pick === "1"} />
      {shoot === "1" && <CameraOverlay />}
    </>
  );
}
