import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { getLegalDoc, isLegalLocale } from "@/lib/legal";

/** 公開私隱政策（商店審核要填的網址）。內容＝App 內同源 JSON。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLegalLocale(locale)) return {};
  return { title: `${getLegalDoc("privacy", locale).title} — hi drink 嗨飲` };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLegalLocale(locale)) notFound();
  setRequestLocale(locale);
  return <LegalDocument slug="privacy" locale={locale} doc={getLegalDoc("privacy", locale)} />;
}
