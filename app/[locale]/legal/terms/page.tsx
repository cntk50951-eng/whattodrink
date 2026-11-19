import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { getLegalDoc, isLegalLocale } from "@/lib/legal";

/** 公開服務條款。內容＝App 內同源 JSON（與舊的 `/terms`「三種模式」說明頁是兩回事，那頁不動）。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLegalLocale(locale)) return {};
  return { title: `${getLegalDoc("terms", locale).title} — hi drink 嗨飲` };
}

export default async function TermsOfServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLegalLocale(locale)) notFound();
  setRequestLocale(locale);
  return <LegalDocument slug="terms" locale={locale} doc={getLegalDoc("terms", locale)} />;
}
