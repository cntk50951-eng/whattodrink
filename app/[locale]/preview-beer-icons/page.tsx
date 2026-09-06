/**
 * TEMPORARY UR2.4 review route — 10 hand-drawn beer icons on one wall.
 * Not linked anywhere. Keep-or-delete decided at UR2.4 review
 * (candidate: illustration-pipeline index later).
 */
import {
  AsahiIcon,
  BlueGirlIcon,
  CoronaIcon,
  HeinekenIcon,
  HoegaardenIcon,
  KirinIcon,
  MoutaiIcon,
  TsingtaoIcon,
  YebisuIcon,
  YoungMasterIcon,
} from "@/components/marketing/beer-icons";

const WALL = [
  { name: "Asahi Super Dry（銀罐）", Icon: AsahiIcon },
  { name: "Corona Extra（透明瓶＋青檸）", Icon: CoronaIcon },
  { name: "Tsingtao Classic（綠瓶）", Icon: TsingtaoIcon },
  { name: "Blue Girl（藍妹）", Icon: BlueGirlIcon },
  { name: "Hoegaarden（六角杯）", Icon: HoegaardenIcon },
  { name: "Heineken（綠瓶紅星）", Icon: HeinekenIcon },
  { name: "Kirin Ichiban（一番搾）", Icon: KirinIcon },
  { name: "Yebisu（金罐）", Icon: YebisuIcon },
  { name: "Young Master（少爺）", Icon: YoungMasterIcon },
  { name: "Moutai Flying Fairy（茅台）", Icon: MoutaiIcon },
] as const;

export default function BeerIconPreview() {
  return (
    <main
      style={{ background: "var(--background)" }}
      className="mx-auto grid max-w-4xl grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-5"
    >
      {WALL.map(({ name, Icon }) => (
        <figure
          key={name}
          style={{ borderColor: "var(--border)" }}
          className="rounded-2xl border-2 bg-card p-3 text-center shadow-[3px_3px_0_var(--border)]"
        >
          <Icon className="mx-auto h-36" />
          <figcaption
            style={{ color: "var(--foreground)" }}
            className="font-hand mt-2 text-sm font-bold"
          >
            {name}
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
