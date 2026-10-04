"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Beer, Check, Heart, MapPin, MessageCircle, Share2, Star } from "lucide-react";

import { formatAvgRating } from "@/lib/api/rating";
import { useCheckinDetail } from "@/hooks/useCheckinDetail";
import { formatWantTime } from "@/lib/wantRecord";

/**
 * UR E.12 打卡面板共享段（v2-only；自家 Sheet＋他人卡同构，数据源只有 checkinId）。
 * 酒 pills（品牌／平均分／地点）＋互动栏（赞／评数／想喝／分享）＋评分（他人可投，作者只读）。
 * 地点名：detail.place_name → 反查 → 面板 fallback → 藏（沿 UR1.8 诚实口径，不编地名）。
 * 图标一律 lucide（原型 Tabler 不引入，见 E.10 约束）。
 */
export function CheckinDetailExtra({
  checkinId,
  fallbackBeerName,
  fallbackPlace,
  lat,
  lng,
  commentsAnchorId,
  refreshTick,
}: {
  /** DB id（无即整块不挂，沿 V2Comments 口径） */
  checkinId: string;
  fallbackBeerName?: string | null;
  fallbackPlace?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** 评论区容器 id（评数按钮点即滚过去；V2Comments 同传此 id） */
  commentsAnchorId: string;
  /** 外部敬酒成功即 bump，觸發重拉對賬（V2Home 乾杯鈕用，沿 E.14 口徑）。 */
  refreshTick?: number;
}) {
  const t = useTranslations("v2");
  const locale = useLocale();
  const { detail, busy, failed, toggleLike, toggleWant, rate, refresh } = useCheckinDetail(checkinId);
  const [toasting, setToasting] = useState<string | null>(null);
  const [toastErr, setToastErr] = useState(false);
  // 外部敬酒对账（refreshTick 翻即重拉；首挂不拉，沿首拉 effect 口径）。
  const firstTick = useRef(true);
  useEffect(() => {
    if (firstTick.current) {
      firstTick.current = false;
      return;
    }
    refresh();
  }, [refreshTick, refresh]);
  const [reverseName, setReverseName] = useState<string | null>(null);
  const reverseKey = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // 地点反查（place_name 空＋有坐标才跑一次；render 取三源优先级，
  // effect 内只做异步 fetch（setState 限回调内），沿 V2GatheringForm 口径）。
  useEffect(() => {
    if (detail?.place_name) return;
    const la = detail?.lat ?? lat ?? null;
    const ln = detail?.lng ?? lng ?? null;
    if (la === null || ln === null) return;
    const key = `${checkinId}:${la},${ln}`;
    if (reverseKey.current === key) return;
    reverseKey.current = key;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/places/reverse?lat=${la}&lng=${ln}`);
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { display_name?: unknown };
        const name =
          typeof j.display_name === "string" && j.display_name !== ""
            ? j.display_name.split(",")[0]
            : null;
        if (!cancelled) setReverseName(name);
      } catch {
        if (!cancelled) setReverseName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkinId, detail?.place_name, detail?.lat, detail?.lng, lat, lng]);

  if (detail === null) {
    // UR E.11：失败沿旧口径藏行；加载中出骨架（行列与实块同构防位移，
    // 尺寸取实块 py／text 级近似，沿 V2Comments 留言骨架口径）。
    if (failed) return null;
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="flex flex-wrap gap-1.5">
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        {/* 骨架不知作者身份，一律按可投形佔位（作者落定換只讀行，僅一行之差）。 */}
        <div className="flex items-center gap-1">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-5 w-5 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="flex items-center gap-2 border-y py-2">
          <div className="h-9 w-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-9 w-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-muted" />
          <span className="flex-1" />
          <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    );
  }
  const beerName = detail.beer_name ?? fallbackBeerName ?? null;
  const placeName = detail.place_name ?? reverseName ?? fallbackPlace ?? null;
  const ratingText = formatAvgRating(detail.rating_avg);

  const share = (): void => {
    const url = window.location.href;
    void (async () => {
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({ url });
          return;
        }
        throw new Error("no-share");
      } catch {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
          copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
        } catch {}
      }
    })();
  };

  const toastBack = (toUserId: string): void => {
    if (toasting !== null) return;
    setToasting(toUserId);
    setToastErr(false);
    void (async () => {
      try {
        const res = await fetch("/api/v1/cheers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ to_user_id: toUserId }),
        });
        if (!res.ok) throw new Error("bad");
        refresh();
      } catch {
        setToastErr(true);
      } finally {
        setToasting(null);
      }
    })();
  };

  const scrollToComments = (): void => {
    document.getElementById(commentsAnchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {(beerName !== null || ratingText !== null || placeName !== null) && (
        <div className="flex flex-wrap gap-1.5">
          {beerName !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              <Beer size={13} aria-hidden />
              {beerName}
            </span>
          )}
          {ratingText !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              <Star size={13} aria-hidden />
              {ratingText}
            </span>
          )}
          {placeName !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              <MapPin size={13} aria-hidden />
              <span className="max-w-44 truncate">{placeName}</span>
            </span>
          )}
        </div>
      )}
      {/* UR E.12：作者身份服务端判（detail.is_author；分支不可信，自家帖从钉点开会落他人分支）。
          作者只读平均＋人数；非作者可投（已投态＋点同星撤分＋清除钮）。 */}
      {detail.is_author ? (
        // UR E.12 空態：同槽佔位（星＋暫無評分，有分即原位替換，沿 YouTube 同槽口徑）。
        <div className="flex items-center gap-1.5">
          <Star
            size={14}
            aria-hidden
            className={detail.rating_avg !== null ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
          />
          {detail.rating_avg !== null ? (
            <>
              <span className="text-xs font-bold">{ratingText}</span>
              <span className="text-xs text-muted-foreground">
                {t("checkinRatingCount", { n: detail.rating_count })}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t("checkinNoRating")}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("checkinRateTitle")}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => rate(detail.my_rating === n ? null : n)}
              disabled={busy}
              aria-label={`${t("checkinRateTitle")} ${n}`}
              className="rounded p-0.5 disabled:opacity-50"
            >
              <Star
                size={16}
                aria-hidden
                className={detail.my_rating !== null && n <= detail.my_rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
              />
            </button>
          ))}
          {detail.rated_by_me && (
            <button
              type="button"
              onClick={() => rate(null)}
              disabled={busy}
              className="rounded px-1 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              {t("checkinRateClear")}
            </button>
          )}
          {detail.rating_avg !== null ? (
            <span className="pl-1 text-xs text-muted-foreground">
              {ratingText} · {t("checkinRatingCount", { n: detail.rating_count })}
            </span>
          ) : (
            <span className="pl-1 text-xs text-muted-foreground">{t("checkinNoRating")}</span>
          )}
        </div>
      )}
      {/* UR E.14 乾杯區（計數＋名單所有人可見，沿 IG 口径；回敬钮仅作者）。 */}
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Beer size={13} aria-hidden />
          {detail.cheers_count > 0
            ? t("cheersCount", { n: detail.cheers_count })
            : t("cheersEmpty")}
        </p>
        {detail.cheers_recent.map((r) => {
          const ms = Date.parse(r.created_at);
          return (
            <div key={`${r.user_id}-${r.created_at}`} className="flex items-center gap-2">
              {r.avatar_url !== null && /^https?:\/\//.test(r.avatar_url) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={r.avatar_url}
                  alt=""
                  loading="lazy"
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground"
                >
                  {r.nickname.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs">
                <span className="font-bold">{r.nickname}</span>
                {Number.isFinite(ms) && (
                  <span className="pl-1.5 text-muted-foreground">
                    {formatWantTime(ms, locale)}
                  </span>
                )}
              </span>
              {detail.is_author && (
                <button
                  type="button"
                  onClick={() => toastBack(r.user_id)}
                  disabled={toasting !== null}
                  className="shrink-0 rounded-full border border-primary px-2.5 py-1 text-xs text-primary disabled:opacity-50"
                >
                  {t("cheersBack")}
                </button>
              )}
            </div>
          );
        })}
        {toastErr && (
          <p role="alert" className="text-xs text-destructive">
            {t("cheersFailed")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 border-y py-2">
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy}
          aria-label={t("checkinLikeCount", { n: detail.like_count })}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 ${
            detail.liked_by_me ? "border-primary text-primary" : "text-muted-foreground"
          }`}
        >
          <Heart size={15} aria-hidden className={detail.liked_by_me ? "fill-current" : ""} />
          {detail.like_count}
        </button>
        <button
          type="button"
          onClick={scrollToComments}
          aria-label={t("checkinCommentCount", { n: detail.comment_count })}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm text-muted-foreground"
        >
          <MessageCircle size={15} aria-hidden />
          {detail.comment_count}
        </button>
        <button
          type="button"
          onClick={toggleWant}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm disabled:opacity-50 ${
            detail.wanted_by_me
              ? "border-primary bg-primary/[0.08] text-primary"
              : "border-primary text-primary"
          }`}
        >
          {t("checkinWant")}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={share}
          aria-label={t("checkinShare")}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />}
        </button>
      </div>
    </>
  );
}
