"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Beer, Check, Heart, Image as ImageIcon, MapPin, Maximize2, MessageCircle, Minimize2, Share2, Star } from "lucide-react";

import { formatRating } from "@/lib/api/rating";
import { useCheckinDetail } from "@/hooks/useCheckinDetail";

/**
 * UR E.10 batch7 半屏固定头（照片缩略图＋酒款＋展开钮；滚动区之上不跟滚，
 * 沿小红书 70% 面板“标题固定、列表独立滚”口径；展开收起只换高度，无手势系统）。
 */
export function CheckinSheetHead({
  photoUrl,
  title,
  sub,
  expanded,
  onToggleExpand,
}: {
  photoUrl: string | null;
  title: string;
  sub: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const t = useTranslations("v2");
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {photoUrl !== null ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={photoUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
      ) : (
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ImageIcon size={18} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{title}</span>
        {sub !== "" && (
          <span className="block truncate text-xs text-muted-foreground">{sub}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={expanded ? t("checkinCollapse") : t("checkinExpand")}
        className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground"
      >
        {expanded ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
      </button>
    </div>
  );
}

/**
 * UR E.10 打卡面板共享段（v2-only；自家 Sheet＋他人卡同构，数据源只有 checkinId）。
 * 酒 pills（品牌／评分／地点）＋互动栏（赞／评数／想喝／分享）＋作者评分器。
 * 地点名：detail.place_name → 反查 → 面板 fallback → 藏（沿 UR1.8 诚实口径，不编地名）。
 * 图标一律 lucide（原型 Tabler 不引入，见 E.10 约束）。
 */
export function CheckinDetailExtra({
  checkinId,
  fallbackBeerName,
  fallbackPlace,
  lat,
  lng,
  canRate,
  commentsAnchorId,
  scrollContainerId,
}: {
  /** DB id（无即整块不挂，沿 V2Comments 口径） */
  checkinId: string;
  fallbackBeerName?: string | null;
  fallbackPlace?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** 作者本人才设评分（他人只读） */
  canRate: boolean;
  /** 评论区容器 id（评数按钮点即滚过去；V2Comments 同传此 id） */
  commentsAnchorId: string;
  /** 面板滚动区容器 id（已在评论区即回顶，否则跳评论区，小红书同款往返） */
  scrollContainerId: string;
}) {
  const t = useTranslations("v2");
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const { detail, busy, toggleLike, toggleWant, rate } = useCheckinDetail(checkinId);
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

  if (detail === null) return null;
  const beerName = detail.beer_name ?? fallbackBeerName ?? null;
  const placeName = detail.place_name ?? reverseName ?? fallbackPlace ?? null;
  const ratingText = formatRating(detail.rating);

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

  const scrollToComments = (): void => {
    const sc = document.getElementById(scrollContainerId);
    const anchor = document.getElementById(commentsAnchorId);
    if (sc === null || anchor === null) return;
    const scRect = sc.getBoundingClientRect();
    const target = anchor.getBoundingClientRect().top - scRect.top + sc.scrollTop;
    // 已在评论区（偏 80px 内）即回顶，否则跳评论区。
    sc.scrollTo({ top: target - sc.scrollTop > 80 ? target : 0, behavior: reducedMotion ? "auto" : "smooth" });
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
      {canRate && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t("checkinRateTitle")}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => rate(detail.rating === n ? null : n)}
              disabled={busy}
              aria-label={`${t("checkinRateTitle")} ${n}`}
              className="rounded p-0.5 disabled:opacity-50"
            >
              <Star
                size={16}
                aria-hidden
                className={detail.rating !== null && n <= detail.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
              />
            </button>
          ))}
          {detail.rating !== null && (
            <button
              type="button"
              onClick={() => rate(null)}
              disabled={busy}
              className="rounded px-1 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              {t("checkinRateClear")}
            </button>
          )}
        </div>
      )}
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
