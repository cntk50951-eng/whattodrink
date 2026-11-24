import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { LEGAL_CHROME, SUPPORT, SUPPORT_EMAIL, isLegalLocale } from "@/lib/legal";

/** 公開客服與支援頁（App Store Support URL／Google Play 客服資料）。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLegalLocale(locale)) return {};
  return { title: `${SUPPORT[locale].title} — hi drink 嗨飲` };
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLegalLocale(locale)) notFound();
  setRequestLocale(locale);
  const d = SUPPORT[locale];
  const c = LEGAL_CHROME[locale];
  return (
    <LegalShell slug="support" locale={locale} title={d.title} effective={d.effective}>
      <p className="leading-relaxed">{d.intro}</p>
      <section aria-labelledby="sup-contact">
        <h2 id="sup-contact" className="text-xl font-semibold">
          {d.contactTitle}
        </h2>
        <p className="mt-3 leading-relaxed">
          {d.contactBody}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>
      <section aria-labelledby="sup-include">
        <h2 id="sup-include" className="text-xl font-semibold">
          {d.includeTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          {d.include.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sup-topics">
        <h2 id="sup-topics" className="text-xl font-semibold">
          {d.topicsTitle}
        </h2>
        <div className="mt-3 space-y-3">
          {d.topics.map((t) => (
            <div key={t.title} className="rounded-xl border p-4">
              <h3 className="font-semibold">{t.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{t.body}</p>
              {t.slug !== undefined ? (
                <p className="mt-2 text-sm">
                  <Link href={`/${locale}/legal/${t.slug}`} className="underline underline-offset-4">
                    {t.slug === "delete-account"
                      ? c.deleteAccount
                      : t.slug === "child-safety"
                        ? c.childSafety
                        : c.privacy}
                  </Link>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </LegalShell>
  );
}
