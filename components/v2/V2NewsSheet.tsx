"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, RefreshCw } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import styles from "./v2.module.css";

type NewsRegion = "hk" | "cn";

type NewsRow = {
  id: string;
  title: string;
  snippet: string;
  source: string;
  source_url: string;
  image_url: string | null;
  published_at: string;
};

function asNewsRow(r: unknown): NewsRow | null {
  if (typeof r !== "object" || r === null) return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.id !== "string" || typeof rec.title !== "string") return null;
  if (typeof rec.source_url !== "string" || !/^https?:\/\//.test(rec.source_url)) return null;
  if (typeof rec.published_at !== "string" || !Number.isFinite(Date.parse(rec.published_at))) {
    return null;
  }
  const img = typeof rec.image_url === "string" && /^https?:\/\//.test(rec.image_url) ? rec.image_url : null;
  return {
    id: rec.id,
    title: rec.title,
    snippet: typeof rec.snippet === "string" ? rec.snippet : "",
    source: typeof rec.source === "string" && rec.source !== "" ? rec.source : "",
    source_url: rec.source_url,
    image_url: img,
    published_at: rec.published_at,
  };
}

function timeOf(locale: string, iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? formatWantTime(ms, locale) : "";
}

/**
 * UR G.2 酒闻列表（v2-only；HK／大陆双籤，沿 E.24 API；失败留旧＋toast，沿 iOS 口径）。
 * 行点即原文外链（新开页）；缺图／缺摘要 fail-soft 不炸卡。
 */
export function V2NewsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [tab, setTab] = useState<NewsRegion>("hk");
  const [byTab, setByTab] = useState<Record<NewsRegion, NewsRow[] | null>>({ hk: null, cn: null });
  const [loading, setLoading] = useState(false);
  const [staleNote, setStaleNote] = useState(false);

  const load = useCallback(
    async (region: NewsRegion) => {
      setLoading(true);
      setStaleNote(false);
      try {
        const res = await fetch(`/api/v1/news?region=${region}&limit=20`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`news ${res.status}`);
        const j = (await res.json()) as { items?: unknown[] };
        const rows = Array.isArray(j.items) ? j.items : [];
        const mapped: NewsRow[] = [];
        for (const r of rows) {
          const m = asNewsRow(r);
          if (m !== null) mapped.push(m);
        }
        setByTab((prev) => ({ ...prev, [region]: mapped }));
      } catch {
        // 失败留旧（旧表不动，只举 toast；沿 iOS “失败留旧＋toast”）。
        setStaleNote(true);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open／切籤即拉属 props-sync（沿 V2SavesSheet 口径）
    if (open) void load(tab);
  }, [open, tab, load]);

  const items = byTab[tab];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("newsTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("newsTitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-full bg-muted p-1" role="tablist">
            {(["hk", "cn"] as NewsRegion[]).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={tab === r}
                onClick={() => setTab(r)}
                className={`flex-1 rounded-full px-3 py-1 text-sm font-bold ${
                  tab === r ? "bg-card shadow" : "text-muted-foreground"
                }`}
              >
                {r === "hk" ? t("newsHk") : t("newsCn")}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load(tab)}
            disabled={loading}
            aria-label={t("newsRetry")}
            className="shrink-0 rounded-full border p-2 text-muted-foreground disabled:opacity-50"
          >
            <RefreshCw size={16} aria-hidden className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {staleNote && (
          <p role="status" className="text-xs text-muted-foreground">
            {t("newsStale")}
          </p>
        )}
        {items === null ? (
          loading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2.5">
                  <span className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
                  <span className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("newsEmpty")}</p>
          )
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("newsEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl border p-2">
                <button
                  type="button"
                  onClick={() => window.open(r.source_url, "_blank", "noopener")}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  {r.image_url !== null ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r.image_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Camera size={18} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{r.title}</span>
                    {r.snippet !== "" && (
                      <span className="block truncate text-xs text-muted-foreground">{r.snippet}</span>
                    )}
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.source, timeOf(locale, r.published_at)].filter((s) => s !== "").join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
