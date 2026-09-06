/**
 * TEMPORARY UR2.4 review route — hand-drawn beer icons on one wall.
 * Entries come from BEER_WALL (shared with the mobile export script).
 * Not linked anywhere. Keep-or-delete decided at UR2.4 review
 * (candidate: illustration-pipeline index later).
 */
import { BEER_WALL } from "@/components/marketing/beer-icons/wall";

export default function BeerIconPreview() {
  return (
    <main
      style={{ background: "var(--background)" }}
      className="mx-auto grid max-w-4xl grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-5"
    >
      {BEER_WALL.map(({ en, cn, Icon }) => (
        <figure
          key={en}
          style={{ borderColor: "var(--border)" }}
          className="rounded-2xl border-2 bg-card p-3 text-center shadow-[3px_3px_0_var(--border)]"
        >
          <Icon className="mx-auto h-36" />
          <figcaption
            style={{ color: "var(--foreground)" }}
            className="font-hand mt-2 text-sm font-bold"
          >
            {en}（{cn}）
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
