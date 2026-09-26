import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";
import { Button } from "@/components/ui/button";

/**
 * UR A.18 T&C 頁：三模式差異＋各自風險＋境外處理＋成年行。
 * 純靜態 Server Component（沿 mood stub 版式＋塗鴉卡，無客戶端 JS）。
 * Footer `/terms` 鏈即生效（鏈早已存在）。
 */
export default async function TermsPage() {
  const t = await getTranslations("terms");
  const modes = [
    { name: t("publicName"), desc: t("publicDesc"), risk: t("publicRisk") },
    { name: t("friendsName"), desc: t("friendsDesc"), risk: t("friendsRisk") },
    { name: t("stealthName"), desc: t("stealthDesc"), risk: t("stealthRisk") },
  ] as const;

  return (
    <Container className="py-10 md:py-14">
      <Stack gap="6" className="mx-auto max-w-2xl">
        <h1 className="font-hand text-3xl font-bold md:text-4xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground leading-relaxed">{t("lede")}</p>
        {modes.map((m) => (
          <section
            key={m.name}
            className="rounded-2xl border-2 bg-card p-5 shadow-[3px_3px_0_var(--border)]"
          >
            <h2 className="font-hand text-xl font-bold">{m.name}</h2>
            <p className="mt-2 text-sm leading-relaxed">{m.desc}</p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {m.risk}
            </p>
          </section>
        ))}
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("crossBorder")}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("ageNote")}
        </p>
        <div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            {t("back")}
          </Button>
        </div>
      </Stack>
    </Container>
  );
}
