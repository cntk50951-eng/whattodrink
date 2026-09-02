import type { Metadata } from "next";
import "./globals.css";

/**
 * Root layout — minimal shell. Locale-specific chrome, providers, and i18n
 * wrapping live in `app/[locale]/layout.tsx`. The `[locale]` dynamic segment
 * is required for next-intl's URL routing under Next.js 16.
 *
 * globals.css is imported HERE (root layout) so Tailwind + design tokens
 * are available to every nested layout / page, not just the locale one.
 */
export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}