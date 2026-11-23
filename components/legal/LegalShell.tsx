import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import {
  LEGAL_CHROME,
  LOCALE_NAMES,
  SUPPORT_EMAIL,
  type LegalLocale,
  type LegalSlug,
} from "@/lib/legal";

const LOCALES: readonly LegalLocale[] = ["zh-Hant", "zh-Hans", "en"];
const SLUGS: readonly LegalSlug[] = ["privacy", "terms", "delete-account"];

/**
 * 公開法律頁共用外框（純靜態 Server Component，零客戶端 JS）：
 * 標題＋生效日期、語言切換、正文、其他文件連結、聯絡信箱。
 * 語言連結一律帶明確前綴（含 zh-Hant），避免被 NEXT_LOCALE cookie 拉回別的語言。
 */
export function LegalShell({
  slug,
  locale,
  title,
  effective,
  version,
  children,
}: {
  slug: LegalSlug;
  locale: LegalLocale;
  title: string;
  effective: string;
  version?: string;
  children: ReactNode;
}) {
  const c = LEGAL_CHROME[locale];
  const labelOf = (s: LegalSlug): string =>
    s === "privacy" ? c.privacy : s === "terms" ? c.terms : c.deleteAccount;
  return (
    <Container size="narrow" className="py-10 md:py-14">
      <article className="mx-auto max-w-2xl">
        <nav aria-label={c.languageLabel} className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground mr-1">{c.languageLabel}</span>
          {LOCALES.map((l) =>
            l === locale ? (
              <span
                key={l}
                aria-current="true"
                className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background"
              >
                {LOCALE_NAMES[l]}
              </span>
            ) : (
              <a
                key={l}
                href={`/${l}/legal/${slug}`}
                hrefLang={l}
                className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                {LOCALE_NAMES[l]}
              </a>
            ),
          )}
        </nav>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {c.effective}：{effective}
          {version !== undefined ? ` · ${c.version} ${version}` : ""}
        </p>
        <div className="mt-8 space-y-8">{children}</div>
        <footer className="mt-12 space-y-3 border-t pt-6 text-sm">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted-foreground">{c.otherDocs}</span>
            {SLUGS.filter((s) => s !== slug).map((s) => (
              <Link key={s} href={`/${locale}/legal/${s}`} className="underline underline-offset-4">
                {labelOf(s)}
              </Link>
            ))}
          </p>
          <p>
            <span className="text-muted-foreground">{c.contact}：</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </footer>
      </article>
    </Container>
  );
}
