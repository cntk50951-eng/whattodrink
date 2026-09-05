import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/marketing/footer";
import { HeaderMenu } from "@/components/marketing/HeaderMenu";

/* UR1.5 note: fonts load via <link> in the root layout (see app/layout.tsx).
 * next/font/google can't fetch in this sandbox (proxy returns truetype-only
 * CSS that next/font fails to bundle — build module-not-found), so the
 * --font-* variables live in globals.css :root instead. */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: `${t("appName")} — ${t("tagline")}`,
    description:
      "Hong Kong drinking-mood companion. Tonight's pick, mood log, photo pick, local bars.",
  };
}

/**
 * Locale-aware layout. Required structure for next-intl on Next.js 16:
 *   - `[locale]` dynamic segment in the path so the proxy can rewrite URLs
 *   - `setRequestLocale(locale)` called here for static rendering support
 *   - `hasLocale` guard → `notFound()` on unsupported values
 *   - Wraps everything in `NextIntlClientProvider` so client components
 *     can call `useTranslations` / `useLocale`
 *
 * Both ThemeProvider and the chrome (header / footer) live here.
 *
 * UR1.5: no theme / language switcher UI on the page (single doodle style,
 * single zh-Hant). The i18n + theme infra stays so multi-theme / multi-locale
 * can return by re-adding the switcher components.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <div
      className="flex min-h-full flex-col antialiased"
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ThemeProvider>
          <header className="border-b-2 border-dashed">
            <Container>
              <div className="flex h-14 items-center justify-between gap-2">
                <Link
                  href="/"
                  className="font-hand text-3xl font-bold tracking-tight"
                >
                  whattodrink
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/auth" />}
                  >
                    {t("signIn")}
                  </Button>
                  {/* UR1.7: retired-Bento entries live here now. Last in the
                      row = closest to the thumb corner. */}
                  <HeaderMenu />
                </div>
              </div>
            </Container>
          </header>

          <main className="flex-1">{children}</main>

          <Footer />
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}