"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MapPin, Star } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePlaceName } from "@/hooks/usePlaceName";
import styles from "./v2.module.css";
import { formatAvgRating } from "@/lib/api/rating";
import { formatWantTime } from "@/lib/wantRecord";

type ShareDetail = {
  photo_url: string | null;
  note: string | null;
  place_name: string | null;
  lat: number | null;
  lng: number | null;
  beer_name: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  created_at: string | null;
};

/**
 * UR E.13 房内打卡卡片（v2-only；分享消息附件分支）。
 * 卡面＝📍釘＋正文 snippet（免 fetch，列表房内同形）；點擊即按需拉
 * `GET /checkins/:id` 彈摘要（圖文分數時地；失敗靜默關）；「查看完整」跳
 * 地圖 `/v2?checkin={id}` 由 V2Home 自開面板（locale 感知）。
 */
export function CheckinCardBubble({
  checkinId,
  title,
  place,
}: {
  checkinId: string;
  /** 卡片标题（用户留言／店名 snippet）。 */
  title: string;
  /** 地点展示（店名／区名，非坐标；空即不显地点行）。 */
  place: string;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ShareDetail | null>(null);
  // UR E.13：弹地名真值优先（place_name），双空即反查坐标（与 Extra 同源）。
  const resolvedPlace = usePlaceName(
    detail?.place_name ?? (place !== "" ? place : null),
    detail?.lat ?? null,
    detail?.lng ?? null,
  );

  const openCard = (): void => {
    setOpen(true);
    setDetail(null);
    void (async () => {
      try {
        const res = await fetch(`/api/v1/checkins/${encodeURIComponent(checkinId)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { checkin?: Record<string, unknown> };
        const c = j.checkin;
        if (typeof c !== "object" || c === null) return;
        const num = (v: unknown): number | null =>
          typeof v === "number" && Number.isFinite(v) ? v : null;
        const avg = num(c.rating_avg);
        const count = num(c.rating_count);
        setDetail({
          photo_url: typeof c.photo_url === "string" ? c.photo_url : null,
          note: typeof c.note === "string" ? c.note : null,
          place_name: typeof c.place_name === "string" ? c.place_name : null,
          lat: typeof c.lat === "number" ? c.lat : null,
          lng: typeof c.lng === "number" ? c.lng : null,
          beer_name: typeof c.beer_name === "string" ? c.beer_name : null,
          rating_avg: avg !== null && avg >= 1 && avg <= 5 ? avg : null,
          rating_count: count !== null && count > 0 ? Math.floor(count) : null,
          created_at: typeof c.created_at === "string" ? c.created_at : null,
        });
      } catch {
        /* 失败留骨架转空（popup 不炸，关即走） */
      }
    })();
  };

  const avgText = formatAvgRating(detail?.rating_avg ?? null);
  const timeText =
    detail?.created_at !== null && detail?.created_at !== undefined
      ? formatWantTime(Date.parse(detail.created_at), locale)
      : "";
  // 弹地名优先详情真值（place_name），发送时 place 为空才回落卡片标题。
  const placeText = resolvedPlace;

  return (
    <>
      <button
        type="button"
        onClick={openCard}
        className="flex max-w-56 items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 text-left shadow-sm"
      >
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.1] text-primary">
          <MapPin size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{title}</span>
          {place !== "" && place !== title && (
            <span className="block truncate text-xs text-muted-foreground">{place}</span>
          )}
          <span className="block text-xs text-muted-foreground">{t("checkinViewFull")}</span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        {/* 房間容器 isolate z-[1000] 自成層疊：content 提到 1100 否則壓住看不見；
            內建 overlay(z-50) 落房間下即無遮罩，外點不關、X／按鈕照走。 */}
        <DialogContent className={`${styles.v2scope} z-[1100] max-w-sm`}>
          <DialogHeader>
            <DialogTitle>{detail?.beer_name ?? title}</DialogTitle>
            {timeText !== "" && <DialogDescription>{timeText}</DialogDescription>}
          </DialogHeader>
          {detail === null ? (
            <div className="flex flex-col gap-2" aria-hidden>
              <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-muted" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {detail.photo_url !== null && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={detail.photo_url}
                  alt=""
                  loading="lazy"
                  className="max-h-64 w-full rounded-xl object-cover"
                />
              )}
              {placeText !== null && placeText !== "" && (
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <MapPin size={14} aria-hidden className="shrink-0 text-primary" />
                  <span className="truncate">{placeText}</span>
                </p>
              )}
              {detail.note !== null && detail.note !== "" && (
                <p className="text-sm">{detail.note}</p>
              )}
              <div className="flex items-center gap-1.5">
                <Star
                  size={14}
                  aria-hidden
                  className={avgText !== null ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
                />
                {avgText !== null && detail.rating_count !== null ? (
                  <>
                    <span className="text-xs font-bold">{avgText}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("checkinRatingCount", { n: detail.rating_count })}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("checkinNoRating")}</span>
                )}
              </div>
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push(`/${locale}/v2?checkin=${encodeURIComponent(checkinId)}`);
                }}
                className="w-full"
              >
                {t("checkinViewFull")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
