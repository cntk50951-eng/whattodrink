import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { DELETE_ACCOUNT, LEGAL_CHROME, isLegalLocale } from "@/lib/legal";

/** 公開刪除帳號說明（Google Play 要求網頁版入口；Apple 要求 App 內可刪除，兩端都有）。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLegalLocale(locale)) return {};
  return { title: `${DELETE_ACCOUNT[locale].title} — hi drink 嗨飲` };
}

export default async function DeleteAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLegalLocale(locale)) notFound();
  setRequestLocale(locale);
  const d = DELETE_ACCOUNT[locale];
  return (
    <LegalShell slug="delete-account" locale={locale} title={d.title} effective={d.effective}>
      <p className="leading-relaxed">{d.intro}</p>
      <section aria-labelledby="del-steps">
        <h2 id="del-steps" className="text-xl font-semibold">
          {d.inAppTitle}
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed">
          {d.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="del-options">
        <h2 id="del-options" className="text-xl font-semibold">
          {d.chooseTitle}
        </h2>
        <div className="mt-3 space-y-3">
          {d.options.map((o) => (
            <div key={o.title} className="rounded-xl border p-4">
              <h3 className="font-semibold">{o.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{o.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="del-after">
        <h2 id="del-after" className="text-xl font-semibold">
          {d.afterTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          {d.after.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="del-cant">
        <h2 id="del-cant" className="text-xl font-semibold">
          {d.cantTitle}
        </h2>
        <p className="mt-3 leading-relaxed">{d.cantBody}</p>
      </section>
      <p className="text-muted-foreground text-sm">
        {d.privacyNote}{" "}
        <Link href={`/${locale}/legal/privacy`} className="underline underline-offset-4">
          {LEGAL_CHROME[locale].privacy}
        </Link>
        {locale === "en" ? "." : "。"}
      </p>
    </LegalShell>
  );
}
