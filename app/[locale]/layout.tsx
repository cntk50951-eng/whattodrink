import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { ThemePicker } from "@/components/theme-picker";
import { LanguagePicker } from "@/components/language-picker";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/marketing/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
 * Both ThemeProvider and the chrome (header / footer) live here so they
 * remount with the locale — which is intentional for the language picker
 * UX (a real reload is a clean reset).
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
      className={`${geistSans.variable} ${geistMono.variable} flex min-h-full flex-col antialiased`}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ThemeProvider>
          <header className="border-b">
            <Container>
              <div className="flex h-14 items-center justify-between gap-2">
                <Link
                  href="/"
                  className="font-heading font-semibold tracking-tight"
                >
                  whattodrink
                </Link>
                <div className="flex items-center gap-2">
                  <ThemePicker />
                  <LanguagePicker />
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/auth" />}
                  >
                    {t("signIn")}
                  </Button>
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