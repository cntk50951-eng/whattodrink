import type { LegalDoc, LegalLocale, LegalSlug } from "@/lib/legal";
import { LegalShell } from "@/components/legal/LegalShell";

/** 渲染 App 內同源的私隱政策／條款 JSON（逐項照搬，不改字）。 */
export function LegalDocument({
  slug,
  locale,
  doc,
}: {
  slug: "privacy" | "terms";
  locale: LegalLocale;
  doc: LegalDoc;
}) {
  const s: LegalSlug = slug;
  return (
    <LegalShell slug={s} locale={locale} title={doc.title} effective={doc.effective} version={doc.version}>
      {doc.note !== "" ? <p className="text-muted-foreground text-sm">{doc.note}</p> : null}
      <section aria-labelledby="legal-summary" className="bg-muted/50 rounded-xl border p-5">
        <h2 id="legal-summary" className="text-base font-semibold">
          {doc.summaryTitle}
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
          {doc.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      {doc.sections.map((sec, i) => (
        <section key={sec.title} aria-labelledby={`legal-s${i}`}>
          <h2 id={`legal-s${i}`} className="text-xl font-semibold">
            {sec.title}
          </h2>
          {sec.tag !== undefined && sec.tag !== "" ? (
            <p className="text-muted-foreground mt-1 text-xs">{sec.tag}</p>
          ) : null}
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
