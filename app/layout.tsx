import type { Metadata } from "next";
import "./globals.css";
// Leaflet default styles (markers, controls, attribution). Global CSS is
// only allowed in the root layout — the map re-skins on top of this via
// components/map/drink-map.module.css. Loaded on every page; negligible.
import "leaflet/dist/leaflet.css";

/**
 * Root layout — minimal shell. Locale-specific chrome, providers, and i18n
 * wrapping live in `app/[locale]/layout.tsx`. The `[locale]` dynamic segment
 * is required for next-intl's URL routing under Next.js 16.
 *
 * globals.css is imported HERE (root layout) so Tailwind + design tokens
 * are available to every nested layout / page, not just the locale one.
 *
 * Fonts load via plain <link> (same as the UR1.4 POC files): next/font/google
 * cannot fetch through this sandbox's proxy at build time, so the --font-*
 * variables are plain :root vars in globals.css.
 */
export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}