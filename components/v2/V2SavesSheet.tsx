"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark, Camera } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import styles from "./v2.module.css";

type SaveRow = {
  id: string;
  photo_url: string | null;
  note: string | null;
  place_name: string | null;
  created_at: string;
  beers: { name: string } | null;
};

function asSaveRow(r: unknown): SaveRow | null {
  if (typeof r !== "object" || r === null) return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.id !== "string" || typeof rec.created_at !== "string") return null;
  const beers =
    typeof rec.beers === "object" && rec.beers !== null
      ? { name: typeof (rec.beers as Record<string, unknown>).name === "string" ? ((rec.beers as Record<string, unknown>).name as string) : "" }
      : null;
  return {
    id: rec.id,
    photo_url: typeof rec.photo_url === "string" ? rec.photo_url : null,
    note: typeof rec.note === "string" && rec.note !== "" ? rec.note : null,
    place_name: typeof rec.place_name === "string" && rec.place_name !== "" ? rec.place_name : null,
    created_at: rec.created_at,
    beers,
  };
}

/**
 * UR G.1 我的收藏（v2-only；行只放摘要＋行内取收；点行开详情由调用方 onOpen 接 map 现有开卡）。
 * 数据沿 GET /me/saves（收藏时间倒序；删帖／不可见服务端已滤）。
 */
export function V2SavesSheet({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  /** 点行开详情（调用方：他人钉 openPin／自家 wantSheet，沿 E.13 深链口径）。 */
  onOpen: (checkinId: string) => void;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const [items, setItems] = useState<SaveRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    try {
      const res = await fetch("/api/v1/me/saves?limit=30", { credentials: "include" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const j = (await res.json()) as { checkins?: unknown[] };
      const rows = Array.isArray(j.checkins) ? j.checkins : [];
      const mapped: SaveRow[] = [];
      for (const r of rows) {
        const m = asSaveRow(r);
        if (m !== null) mapped.push(m);
      }
      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open 翻即拉列表属 props-sync（沿 useCheckinDetail 切帖重置豁免口径）
    if (open) void load();
  }, [open, load]);

  const unsave = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(id)}/save`, {
          method: "POST",
          credentials: "include",
        });
        const j = (await res.json().catch(() => null)) as { saved?: unknown } | null;
        if (!res.ok || typeof j?.saved !== "boolean") throw new Error("bad");
        if (j.saved === false) {
          setItems((prev) => (prev === null ? prev : prev.filter((r) => r.id !== id)));
        } else {
          await load();
        }
      } catch {
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("savesTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("savesTitle")}</SheetDescription>
        </SheetHeader>
        {items === null ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2.5">
                <span className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
                <span className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("savesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2.5 rounded-xl border p-2"
              >
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-label={r.note ?? r.place_name ?? r.beers?.name ?? r.id}
                >
                  {r.photo_url !== null && r.photo_url.startsWith("data:image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r.photo_url} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Camera size={18} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {r.note ?? r.place_name ?? r.beers?.name ?? ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.place_name, formatWantTime(Date.parse(r.created_at), locale)]
                        .filter((s) => s !== "")
                        .join(" · ")}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void unsave(r.id)}
                  disabled={busyId === r.id}
                  aria-label={t("savesTitle")}
                  aria-pressed
                  className="shrink-0 rounded-full p-2 text-primary disabled:opacity-50"
                >
                  <Bookmark size={18} aria-hidden className="fill-current" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
