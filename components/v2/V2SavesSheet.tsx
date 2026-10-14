"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark, Camera, MapPin, Navigation, Pin } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWantTime } from "@/lib/wantRecord";
import { findPinned, type PinnedPlace } from "@/lib/pinnedPlaces";
import styles from "./v2.module.css";

type SaveRow = {
  id: string;
  photo_url: string | null;
  note: string | null;
  place_name: string | null;
  created_at: string;
  beers: { name: string } | null;
  lat: number | null;
  lng: number | null;
  expired: boolean;
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
    lat: typeof rec.lat === "number" && Number.isFinite(rec.lat) ? rec.lat : null,
    lng: typeof rec.lng === "number" && Number.isFinite(rec.lng) ? rec.lng : null,
    expired: rec.expired === true,
  };
}

/**
 * UR G.1 我的收藏（v2-only；行只放摘要＋行内取收；点行开详情由调用方 onOpen 接 map 现有开卡）。
 * UR G.9 過期保留（灰顯＋已過期＋帶我去地圖＋Pin 住位置；開卡只收現行帖）＋我的地點區。
 * 数据沿 GET /me/saves（收藏时间倒序；删帖／不可见服务端已滤；過期行帶 expired:true）。
 */
export function V2SavesSheet({
  open,
  onClose,
  onOpen,
  pinned,
  onTogglePin,
  onLocate,
}: {
  open: boolean;
  onClose: () => void;
  /** 点行开详情（调用方：他人钉 openPin／自家 wantSheet，沿 E.13 深链口径）。 */
  onOpen: (checkinId: string) => void;
  /** UR G.9：已 pin 地點（调用方 localStorage 直供）。 */
  pinned: PinnedPlace[];
  /** UR G.9：Pin 住／取消（调用方持久化＋刷圖）。 */
  onTogglePin: (p: { name: string; lat: number; lng: number; sourceCheckinId: string | null }) => void;
  /** UR G.9：帶我去地圖位置（调用方 flyTo＋關 Sheet）。 */
  onLocate: (lat: number, lng: number) => void;
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
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-bold text-muted-foreground">{t("pinnedTitle")}</p>
                <ul className="flex flex-col gap-1.5">
                  {pinned.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-xl border border-amber-600/40 p-2">
                      <span aria-hidden className="shrink-0 text-base">📌</span>
                      <button
                        type="button"
                        onClick={() => onLocate(p.lat, p.lng)}
                        className="min-w-0 flex-1 truncate text-left text-sm font-bold"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onTogglePin({ name: p.name, lat: p.lat, lng: p.lng, sourceCheckinId: p.sourceCheckinId })}
                        aria-label={t("pinnedUnpin")}
                        className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold"
                      >
                        {t("pinnedUnpin")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("savesEmpty")}</p>
            ) : (
          <ul className="flex flex-col gap-2">
            {items.map((r) => {
              const hasPos = r.lat !== null && r.lng !== null;
              const isPinned = hasPos && findPinned(pinned, r.lat as number, r.lng as number) !== null;
              const label = r.note ?? r.place_name ?? r.beers?.name ?? "";
              return (
              <li
                key={r.id}
                className={`flex flex-col gap-1.5 rounded-xl border p-2 ${r.expired ? "opacity-70" : ""}`}
              >
                <span className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      // UR G.9：過期行點行即帶我去地圖（內容已不可看）；現行行開卡。
                      if (r.expired) {
                        if (hasPos) onLocate(r.lat as number, r.lng as number);
                        return;
                      }
                      onOpen(r.id);
                    }}
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
                        {label}
                        {r.expired && (
                          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {t("savesExpired")}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[r.place_name, formatWantTime(Date.parse(r.created_at), locale)]
                          .filter((s) => s !== "")
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  {!r.expired && (
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
                  )}
                </span>
                {hasPos && (
                  <span className="flex gap-1.5 pl-14">
                    <button
                      type="button"
                      onClick={() => onLocate(r.lat as number, r.lng as number)}
                      className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold"
                    >
                      <Navigation size={12} aria-hidden />
                      {t("savesGo")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nm = r.place_name ?? label;
                        return onTogglePin({
                          name: nm !== "" ? nm : t("pinnedFallback"),
                          lat: r.lat as number,
                          lng: r.lng as number,
                          sourceCheckinId: r.id,
                        });
                      }}
                      aria-pressed={isPinned}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${isPinned ? "border-primary text-primary" : ""}`}
                    >
                      {isPinned ? <MapPin size={12} aria-hidden /> : <Pin size={12} aria-hidden />}
                      {isPinned ? t("pinnedDone") : t("pinnedAdd")}
                    </button>
                  </span>
                )}
              </li>
              );
            })}
          </ul>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
