"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, MapPin, RotateCcw, Sparkles, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import styles from "./v2.module.css";
import {
  CAMERA_CONSENT_KEY,
  classifyGetUserMediaError,
  loadCameraConsent,
  type CameraErrorKind,
} from "@/lib/camera";
import type { PhotoFilterId } from "@/lib/photoFilters";
import { PHOTO_FILTER_IDS, fitPhotoSize, photoFilterCss } from "@/lib/photoFilters";

export type PublishShot = {
  photoDataUrl: string;
  note: string;
  kind: "flash" | "post";
};

export type PublishResult =
  | { ok: true }
  | { ok: false; message: string };

type Phase = "ask" | "kind" | "live" | "denied" | "review";

const KIND_CARDS = [
  { kind: "flash", Icon: Zap },
  { kind: "post", Icon: MapPin },
] as const;

type Kind = (typeof KIND_CARDS)[number]["kind"];

/**
 * UR E.3 v2 相机一页流（IG 单 composer 心智＋Snap 一键心智）。
 * ask（权限门）→ kind（每次必选，无默认；点选即进，左右滑动只切换不进）
 * → live（取景＋滤镜，顶栏可回改类型）→ review／compose（类型滑块可改＋
 * 照片缩略配文 IG 式＋底部 sticky 发布；rejected 行内 banner
 * 留现场重发）。录音已退役、选酒已退场：零 mic 代码，compose 无酒区。
 * 关 Sheet 即停流（摄像头灯灭）；真磨皮／人脸贴纸不做（见 UR）。
 */
export function V2CameraSheet({
  open,
  onOpenChange,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublish: (shot: PublishShot) => Promise<PublishResult>;
}) {
  const t2 = useTranslations("v2");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const touchXRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("ask");
  const [deniedKind, setDeniedKind] = useState<CameraErrorKind>("unknown");
  const [kind, setKind] = useState<Kind | null>(null);
  const [filterId, setFilterId] = useState<PhotoFilterId>("none");
  const [beauty, setBeauty] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v !== null) v.srcObject = null;
  }, []);

  const resetShot = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setKind(null);
    setPhoto(null);
    setNote("");
    setPublishing(false);
    setPublishError(null);
  }, []);

  // 只取流不切 phase（kind 步后台预热，选中即进 live，体感更快）。
  const ensureStream = useCallback(async (): Promise<boolean> => {
    try {
      if (
        typeof navigator === "undefined" ||
        navigator.mediaDevices?.getUserMedia === undefined
      ) {
        setDeniedKind("no-device");
        setPhase("denied");
        return false;
      }
      if (streamRef.current !== null) return true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      try {
        window.localStorage.setItem(CAMERA_CONSENT_KEY, "1");
      } catch {
        // 隱私模式寫失敗不擋路
      }
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "Error";
      setDeniedKind(classifyGetUserMediaError(name));
      setPhase("denied");
      return false;
    }
  }, []);

  // 取景掛載後掛流（video 節點 live 階段才掛載，取流時拿不到 ref——黑屏根因既修法）。
  useEffect(() => {
    if (phase !== "live") return;
    const v = videoRef.current;
    const s = streamRef.current;
    if (v === null || s === null) return;
    v.srcObject = s;
    void v.play().catch(() => {});
  }, [phase]);

  // 開關門（事件側設值；effect 只調會話函數＋純外部清理，不直寫 state）。
  function handleOpenChange(v: boolean): void {
    if (!v) {
      stopTracks();
      setPhase("ask");
      resetShot();
    }
    onOpenChange(v);
  }

  // 新會話＝清上一拍＋kind 步（consent 有即后台预热流；間接調用，effect 本體無 setState，合規）。
  const beginSession = useCallback(() => {
    resetShot();
    if (loadCameraConsent()) {
      setPhase("kind");
      void ensureStream();
    } else {
      setPhase("ask");
    }
  }, [resetShot, ensureStream]);

  useEffect(() => {
    if (!open) {
      stopTracks();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開門即新會話，沿 ChatThread 口徑
    beginSession();
  }, [open, beginSession, stopTracks]);

  useEffect(() => stopTracks, [stopTracks]);

  function capture(): void {
    const v = videoRef.current;
    if (v === null || v.videoWidth === 0) return;
    const { w, h } = fitPhotoSize(v.videoWidth, v.videoHeight);
    if (w === 0 || h === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.filter = photoFilterCss(filterId, beauty);
    ctx.drawImage(v, 0, 0, w, h);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    setPublishError(null);
    setPhase("review");
  }

  // 类型点选即进（每次必选，无默认；滑动只切换不进，防误触）。
  function chooseKind(k: Kind): void {
    setKind(k);
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      setPhase("live");
    }, 220);
  }

  function onKindTouchStart(e: React.TouchEvent): void {
    touchXRef.current = e.touches[0]?.clientX ?? null;
  }

  function onKindTouchEnd(e: React.TouchEvent): void {
    const startX = touchXRef.current;
    touchXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) < 40) return;
    // 右滑→快贴，左滑→帖子（只高亮，不进，点选才进）。
    setKind(dx > 0 ? "flash" : "post");
  }

  async function publish(): Promise<void> {
    if (photo === null || kind === null || publishing) return;
    setPublishing(true);
    setPublishError(null);
    const res = await onPublish({
      photoDataUrl: photo,
      note: note.trim(),
      kind,
    });
    setPublishing(false);
    if (res.ok) {
      onOpenChange(false);
      return;
    }
    // 被拒留现场：照片／文字／类型／酒全保留，改完点发布即重发。
    setPublishError(res.message);
  }

  const liveCss = photoFilterCss(filterId, beauty);
  const kindIndex = kind === "flash" ? 0 : 1;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[92svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="text-left">
          <SheetTitle>{t2("camTitle")}</SheetTitle>
          <SheetDescription>{t2("camWhy")}</SheetDescription>
        </SheetHeader>

        {phase === "ask" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Camera size={24} className="text-muted-foreground" />
            </span>
            <p className="max-w-64 text-sm text-muted-foreground">{t2("camWhy")}</p>
            <Button
              onClick={() => {
                void ensureStream().then((ok) => {
                  if (ok) setPhase("kind");
                });
              }}
            >
              <Camera size={16} aria-hidden />
              {t2("camEnable")}
            </Button>
          </div>
        )}

        {phase === "denied" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-64 text-sm font-bold">
              {deniedKind === "no-device" ? t2("camNoDevice") : t2("camDenied")}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void ensureStream().then((ok) => {
                    if (ok) setPhase("kind");
                  });
                }}
              >
                {t2("camRetry")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X size={15} aria-hidden />
                {t2("cancel")}
              </Button>
            </div>
          </div>
        )}

        {phase === "kind" && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-center text-sm font-bold">{t2("camKindTitle")}</p>
            <div
              role="radiogroup"
              aria-label={t2("camKindTitle")}
              className="grid grid-cols-2 gap-3"
              onTouchStart={onKindTouchStart}
              onTouchEnd={onKindTouchEnd}
            >
              {KIND_CARDS.map(({ kind: k, Icon }) => {
                const selected = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseKind(k)}
                    className={`flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 active:scale-95 ${
                      selected
                        ? "border-foreground bg-muted shadow-md"
                        : "border-border bg-card"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                        selected ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon size={22} />
                    </span>
                    <span className="text-base font-bold">
                      {k === "flash" ? t2("flashTitle") : t2("postTitle")}
                    </span>
                    <span className="text-center text-xs text-muted-foreground">
                      {k === "flash" ? t2("flashDesc") : t2("postDesc")}
                    </span>
                    {selected && (
                      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground">{t2("camKindHint")}</p>
          </div>
        )}

        {phase === "live" && (
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setPhase("kind")}
              >
                {kind === "flash" ? t2("flashTitle") : t2("postTitle")}
                <span aria-hidden className="text-xs">▾</span>
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[3/4] w-full object-cover"
                style={{ filter: liveCss === "none" ? undefined : liveCss }}
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {PHOTO_FILTER_IDS.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={filterId === id ? "secondary" : "ghost"}
                  aria-pressed={filterId === id}
                  className="shrink-0 rounded-full"
                  onClick={() => setFilterId(id)}
                >
                  {t2(`camFilter_${id}`)}
                </Button>
              ))}
              <Button
                size="sm"
                variant={beauty ? "secondary" : "ghost"}
                aria-pressed={beauty}
                className="shrink-0 rounded-full"
                onClick={() => setBeauty((v) => !v)}
              >
                <Sparkles size={14} aria-hidden />
                {t2("camBeauty")}
              </Button>
            </div>
            <Button className="w-full rounded-full" onClick={capture}>
              <Camera size={16} aria-hidden />
              {t2("camCapture")}
            </Button>
          </>
        )}

        {phase === "review" && photo !== null && kind !== null && (
          <>
            {publishError !== null && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"
              >
                {publishError}
                <span className="block pt-0.5 text-xs font-normal opacity-90">
                  {t2("camRejectedKept")}
                </span>
              </p>
            )}
            {/* 类型滑块（compose 内可改；滑块 modern 滑动效）。 */}
            <div
              role="radiogroup"
              aria-label={t2("camKindTitle")}
              className="relative grid shrink-0 grid-cols-2 rounded-full border border-border bg-muted p-1"
            >
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-card shadow transition-transform duration-200 ${
                  kindIndex === 1 ? "translate-x-full" : "translate-x-0"
                }`}
              />
              {(["flash", "post"] as const).map((k, i) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold transition-colors ${
                    kindIndex === i ? "" : "text-muted-foreground"
                  }`}
                >
                  {k === "flash" ? t2("flashTitle") : t2("postTitle")}
                </button>
              ))}
            </div>
            {/* IG 式图文行：缩略＋配文并排，键盘不再把输入框顶到天边。 */}
            <div className="flex shrink-0 items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="aspect-[3/4] w-20 shrink-0 rounded-lg object-cover" />
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t2("camNotePh")}
                aria-label={t2("camNotePh")}
                className="max-h-28 min-h-20 w-full flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {/* UR E.3 round-2：酒已退场——打卡未必要选酒，compose 只剩图文＋类型。 */}
            <div className="sticky bottom-0 -mx-4 shrink-0 border-t border-border bg-background/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  disabled={publishing}
                  onClick={() => {
                    setPhoto(null);
                    setPublishError(null);
                    setPhase("live");
                  }}
                >
                  <RotateCcw size={15} aria-hidden />
                  {t2("camRetake")}
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  disabled={publishing}
                  onClick={() => void publish()}
                >
                  <Check size={15} aria-hidden />
                  {publishing ? t2("camPublishing") : t2("camPublish")}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
