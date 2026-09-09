import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { WallGrid } from "@/components/wall/WallGrid";

/** UR4.1 公開牆（畫面3）。Client 內讀牆＋排序＋紅點，頁面只給殼＋返回。 */
export default async function WallPage() {
  const t = await getTranslations("wall");
  const tb = await getTranslations("stubs");
  return (
    <Container className="py-10 md:py-16">
      <h1 className="font-hand text-4xl font-bold tracking-tight md:text-5xl">
        {t("title")}
      </h1>
      <div className="mt-6">
        <WallGrid />
      </div>
      <div className="mx-auto mt-8 w-full max-w-xl">
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/" />}>
          {tb("back")}
        </Button>
      </div>
    </Container>
  );
}
