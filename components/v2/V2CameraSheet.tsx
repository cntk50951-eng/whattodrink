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
import {
  TEXT_COLORS,
  TEXT_MAX,
  adjustCss,
  blankEdit,
  blankText,
  cropRect,
  rotatedSize,
  sanitizeEdit,
  sanitizeText,
  wrapLines,
  type PhotoEdit,
  type PhotoRatio,
  type TextLayer,
  type TextPos,
} from "@/lib/photoEdit";

export type PublishShot = {
  photoDataUrl: string;
  /** UR E.20 他人釘縮影（96px JPEG data:，可空；缺即他人釘回退）。 */
  photoThumb: string;
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
  // UR E.20 他人釘縮影（拍攝即產，發布隨單；失败即空串，他人釘回退）。
  const [photoThumb, setPhotoThumb] = useState("");
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  // UR G.11 review 編輯（底部模式欄；烘焙輸入單一對象＋历史撤销，上限 40）。
  const [photoBase, setPhotoBase] = useState<string | null>(null);
  const [bake, setBake] = useState<{ edit: PhotoEdit; text: TextLayer; filter: PhotoFilterId; beauty: boolean } | null>(null);
  const [hist, setHist] = useState<{ edit: PhotoEdit; text: TextLayer; filter: PhotoFilterId; beauty: boolean }[]>([]);
  const [editMode, setEditMode] = useState<"filter" | "adjust" | "crop" | "text">("filter");
  const bakeIdRef = useRef(0);

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
    setPhotoBase(null);
    setBake(null);
    setHist([]);
    setEditMode("filter");
    setPhotoThumb("");
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
    // 原片直存（濾鏡進烘焙管線，review 改濾鏡可重烘；iOS 管線口徑）。
    ctx.drawImage(v, 0, 0, w, h);
    const base = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoBase(base);
    const init = { edit: blankEdit(), text: blankText(), filter: filterId, beauty };
    setBake(init);
    setHist([]);
    setEditMode("filter");
    setPublishError(null);
    setPhase("review");
  }

  /**
   * UR G.11 烘焙（旋轉→裁切→調整＋濾鏡→文字；兩 pass＋文字層，預覽即成圖）。
   * stale 守衛：連拖滑桿只留最後一次成圖。
   */
  const rebake = useCallback(
    async (base: string, b: { edit: PhotoEdit; text: TextLayer; filter: PhotoFilterId; beauty: boolean }) => {
      const myId = (bakeIdRef.current += 1);
      try {
        const img = new Image();
        img.src = base;
        await img.decode();
        if (bakeIdRef.current !== myId || img.naturalWidth === 0) return;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const rot = rotatedSize(iw, ih, b.edit.quarterTurns);
        if (rot.w === 0 || rot.h === 0) return;
        // pass1 旋轉
        const c1 = document.createElement("canvas");
        c1.width = rot.w;
        c1.height = rot.h;
        const x1 = c1.getContext("2d");
        if (x1 === null) return;
        x1.translate(rot.w / 2, rot.h / 2);
        x1.rotate(((b.edit.quarterTurns % 4) * Math.PI) / 2);
        x1.drawImage(img, -iw / 2, -ih / 2);
        // pass2 裁切＋調整＋濾鏡一次畫出
        const cr = cropRect(rot.w, rot.h, b.edit.ratio);
        if (cr.w === 0 || cr.h === 0) return;
        const c2 = document.createElement("canvas");
        c2.width = cr.w;
        c2.height = cr.h;
        const x2 = c2.getContext("2d");
        if (x2 === null) return;
        const css = [photoFilterCss(b.filter, b.beauty), adjustCss(b.edit)].filter((s) => s !== "" && s !== "none").join(" ");
        if (css !== "") {
          try {
            x2.filter = css;
          } catch {}
        }
        x2.drawImage(c1, cr.x, cr.y, cr.w, cr.h, 0, 0, cr.w, cr.h);
        try {
          x2.filter = "none";
        } catch {}
        // 文字層（描邊＋居中＋三檔位＋自動換行）
        if (b.text.text.trim() !== "") {
          const minDim = Math.min(cr.w, cr.h);
          const px = b.text.size === 1 ? minDim * 0.05 : b.text.size === 3 ? minDim * 0.09 : minDim * 0.07;
          x2.font = `700 ${Math.max(12, Math.round(px))}px system-ui, sans-serif`;
          x2.textAlign = "center";
          x2.textBaseline = "middle";
          const lines = wrapLines(x2, b.text.text.trim().slice(0, TEXT_MAX), cr.w - 32, 3);
          const lh = px * 1.25;
          const blockH = lines.length * lh;
          const cy = b.text.pos === "top" ? blockH / 2 + 20 : b.text.pos === "center" ? cr.h / 2 : cr.h - blockH / 2 - 20;
          lines.forEach((ln, i) => {
            const y = cy - blockH / 2 + lh * (i + 0.5);
            x2.lineWidth = Math.max(2, Math.round(px / 12));
            x2.strokeStyle = "rgba(0,0,0,0.75)";
            x2.strokeText(ln, cr.w / 2, y);
            x2.fillStyle = b.text.color;
            x2.fillText(ln, cr.w / 2, y);
          });
        }
        if (bakeIdRef.current !== myId) return;
        const out = c2.toDataURL("image/jpeg", 0.85);
        setPhoto(out);
        try {
          const scale = Math.min(1, 96 / Math.max(cr.w, cr.h));
          const tw = Math.max(1, Math.round(cr.w * scale));
          const th = Math.max(1, Math.round(cr.h * scale));
          const tiny = document.createElement("canvas");
          tiny.width = tw;
          tiny.height = th;
          const tctx = tiny.getContext("2d");
          if (tctx !== null) {
            tctx.drawImage(c2, 0, 0, tw, th);
            setPhotoThumb(tiny.toDataURL("image/jpeg", 0.7));
          } else {
            setPhotoThumb("");
          }
        } catch {
          setPhotoThumb("");
        }
      } catch {}
    },
    [],
  );

  useEffect(() => {
    if (phase !== "review" || photoBase === null || bake === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 輸入變即重烘屬 props-sync（沿 V2NewsSheet 口径）
    void rebake(photoBase, bake);
  }, [phase, photoBase, bake, rebake]);

  /** 烘焙輸入更新（入棧舊值供撤销，上限 40；事件側直寫，updater 內不套 setState）。 */
  function updateBake(patch: Partial<{ edit: PhotoEdit; text: TextLayer; filter: PhotoFilterId; beauty: boolean }>): void {
    if (bake === null) return;
    setHist((h) => [...h.slice(-39), bake]);
    setBake({ ...bake, ...patch });
  }

  function undoBake(): void {
    const last = hist[hist.length - 1];
    if (last === undefined) return;
    setBake(last);
    setHist(hist.slice(0, -1));
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
      photoThumb,
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
            {/* UR G.11 review 底部模式欄（濾鏡｜調整｜裁切｜文字＋撤销重置；改動即重烘，預覽即成圖）。 */}
            {bake !== null && (
              <div className="flex shrink-0 flex-col gap-2 rounded-xl border p-2">
                <div className="flex items-center gap-1" role="tablist" aria-label={t2("camEditTitle")}>
                  {(["filter", "adjust", "crop", "text"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={editMode === m}
                      onClick={() => setEditMode(m)}
                      className={`flex-1 rounded-full px-2 py-1 text-xs font-bold ${editMode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
                    >
                      {t2(`camEdit_${m}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={hist.length === 0}
                    onClick={undoBake}
                    aria-label={t2("camEditUndo")}
                    className="rounded-full border p-1.5 disabled:opacity-40"
                  >
                    <RotateCcw size={13} aria-hidden />
                  </button>
                </div>
                {editMode === "filter" && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {PHOTO_FILTER_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={bake.filter === id}
                        onClick={() => updateBake({ filter: id })}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${bake.filter === id ? "border-primary text-primary" : ""}`}
                      >
                        {t2(`camFilter_${id}`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={bake.beauty}
                      onClick={() => updateBake({ beauty: !bake.beauty })}
                      className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${bake.beauty ? "border-primary text-primary" : ""}`}
                    >
                      <Sparkles size={12} aria-hidden />
                      {t2("camBeauty")}
                    </button>
                  </div>
                )}
                {editMode === "adjust" && (
                  <div className="flex flex-col gap-1.5">
                    {(
                      [
                        ["brightness", "camAdjBright"],
                        ["contrast", "camAdjContrast"],
                        ["saturation", "camAdjSat"],
                        ["warmth", "camAdjWarm"],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 text-xs">
                        <span className="w-10 shrink-0 text-muted-foreground">{t2(label)}</span>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          value={Math.round(bake.edit[k] * 100)}
                          onChange={(e) => updateBake({ edit: sanitizeEdit({ ...bake.edit, [k]: Number(e.target.value) / 100 }) })}
                          className="w-full"
                        />
                        <span className="w-10 shrink-0 text-right font-bold">{Math.round(bake.edit[k] * 100)}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateBake({ edit: { ...bake.edit, brightness: 0, contrast: 0, saturation: 0, warmth: 0 } })}
                      className="self-end text-xs text-muted-foreground"
                    >
                      {t2("camAdjReset")}
                    </button>
                  </div>
                )}
                {editMode === "crop" && (
                  <div className="flex items-center gap-1.5">
                    {(["original", "square", "portrait"] as PhotoRatio[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={bake.edit.ratio === r}
                        onClick={() => updateBake({ edit: sanitizeEdit({ ...bake.edit, ratio: r }) })}
                        className={`flex-1 rounded-full border px-2 py-1 text-xs font-bold ${bake.edit.ratio === r ? "border-primary text-primary" : ""}`}
                      >
                        {t2(`camRatio_${r}`)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateBake({ edit: sanitizeEdit({ ...bake.edit, quarterTurns: bake.edit.quarterTurns + 1 }) })}
                      aria-label={t2("camRotate")}
                      className="rounded-full border p-1.5"
                    >
                      <RotateCcw size={13} aria-hidden className="-scale-x-100" />
                    </button>
                  </div>
                )}
                {editMode === "text" && (
                  <div className="flex flex-col gap-1.5">
                    <input
                      value={bake.text.text}
                      maxLength={TEXT_MAX}
                      placeholder={t2("camTextPh")}
                      onChange={(e) => updateBake({ text: sanitizeText({ ...bake.text, text: e.target.value }) })}
                      className="rounded-xl border px-2.5 py-1.5 text-sm"
                    />
                    <div className="flex items-center gap-1.5">
                      {TEXT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateBake({ text: sanitizeText({ ...bake.text, color: c }) })}
                          aria-pressed={bake.text.color === c}
                          aria-label={c}
                          style={{ backgroundColor: c }}
                          className={`h-6 w-6 shrink-0 rounded-full border ${bake.text.color === c ? "ring-2 ring-primary ring-offset-1" : "border-border"}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {([1, 2, 3] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateBake({ text: sanitizeText({ ...bake.text, size: s }) })}
                          aria-pressed={bake.text.size === s}
                          className={`flex-1 rounded-full border px-2 py-1 text-xs font-bold ${bake.text.size === s ? "border-primary text-primary" : ""}`}
                        >
                          {t2(`camTextSize_${s}`)}
                        </button>
                      ))}
                      {(["top", "center", "bottom"] as TextPos[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateBake({ text: sanitizeText({ ...bake.text, pos: p }) })}
                          aria-pressed={bake.text.pos === p}
                          className={`flex-1 rounded-full border px-2 py-1 text-xs font-bold ${bake.text.pos === p ? "border-primary text-primary" : ""}`}
                        >
                          {t2(`camTextPos_${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                    setPhotoThumb("");
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
