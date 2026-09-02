import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Stack } from "@/components/layout/stack";

export async function Footer() {
  const t = await getTranslations("footer");

  const links = [
    { key: "about", href: "/about" },
    { key: "privacy", href: "/privacy" },
    { key: "terms", href: "/terms" },
    { key: "contact", href: "mailto:hello@whattodrink.app" },
  ] as const;

  return (
    <footer className="border-t mt-auto">
      <Container className="py-8 md:py-12">
        <Stack
          direction={{ base: "col", md: "row" }}
          gap="6"
          justify="between"
          align={{ base: "start", md: "center" }}
        >
          <Stack gap="2">
            <p className="font-heading font-semibold">whattodrink</p>
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </Stack>

          <nav aria-label="Footer">
            <Stack direction="row" gap="6" className="text-sm flex-wrap">
              {links.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t(`links.${link.key}`)}
                </Link>
              ))}
            </Stack>
          </nav>
        </Stack>

        <p className="text-xs text-muted-foreground mt-6">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
      </Container>
    </footer>
  );
}