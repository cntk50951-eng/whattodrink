import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { INTRO_COPY } from "@/components/intro-next/copy";
import { introMetadata } from "@/components/intro-next/metadata";
import { IntroClient } from "@/components/intro-next/IntroClient";
import { routing, type AppLocale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

function getLocale(raw: string): AppLocale {
  if (!routing.locales.includes(raw as AppLocale)) notFound();
  return raw as AppLocale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return introMetadata(getLocale((await params).locale), true);
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#090f14" };

export default async function IntroPage({ params }: Props): Promise<ReactElement> {
  const locale = getLocale((await params).locale);
  const copy = INTRO_COPY[locale];
  return (
    <>
      <h1 className="sr-only">{copy.title}</h1>
      <p className="sr-only">{copy.description}</p>
      <div className="sr-only">{Object.values(copy.scenes).map((scene, i) => <section key={i}><h2>{scene.title} {scene.accent}</h2><p>{scene.sub}</p></section>)}</div>
      <IntroClient locale={locale} basePath="intro" />
    </>
  );
}
