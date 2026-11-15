import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { ArtworkGallery } from "@/components/intro-next/ArtworkGallery";
import { routing, type AppLocale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { title: "WhatToDrink", robots: { index: false, follow: false } };

export default async function ArtworkPage({ params }: Props): Promise<ReactElement> {
  const raw = (await params).locale;
  if (!routing.locales.includes(raw as AppLocale)) notFound();
  return <ArtworkGallery locale={raw as AppLocale} basePath="intro" />;
}
