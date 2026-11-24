import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { CHILD_SAFETY, isLegalLocale } from "@/lib/legal";

/** 公開兒少安全標準（Google Play 社交／約會類 App 要求；內容只寫已存在的機制）。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLegalLocale(locale)) return {};
  return { title: `${CHILD_SAFETY[locale].title} — hi drink 嗨飲` };
}

export default async function ChildSafetyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLegalLocale(locale)) notFound();
  setRequestLocale(locale);
  const d = CHILD_SAFETY[locale];
  return (
    <LegalShell slug="child-safety" locale={locale} title={d.title} effective={d.effective}>
      <p className="leading-relaxed">{d.intro}</p>
      {d.sections.map((sec, i) => (
        <section key={sec.title} aria-labelledby={`cs-s${i}`}>
          <h2 id={`cs-s${i}`} className="text-xl font-semibold">
            {sec.title}
          </h2>
          {sec.paragraphs.map((p) => (
            <p key={p} className="mt-3 leading-relaxed">
              {p}
            </p>
          ))}
          {sec.bullets !== undefined && sec.bullets.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
              {sec.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </LegalShell>
  );
}
