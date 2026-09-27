"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, Mic, RotateCcw, Sparkles, Square, Trash2, X } from "lucide-react";

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
  MAX_VOICE_SECONDS,
  classifyGetUserMediaError,
  loadCameraConsent,
  type CameraErrorKind,
} from "@/lib/camera";
import {
  PHOTO_FILTER_IDS,
  fitPhotoSize,
  photoFilterCss,
  type PhotoFilterId,
} from "@/lib/photoFilters";

export type StagedShot = {
  photoDataUrl: string;
  filterId: PhotoFilterId;
  note: string;
  audioUrl: string | null;
  audioSeconds: number;
};

type Phase = "ask" | "live" | "denied" | "review";

/**
 * UR E.1 v2 相機 Sheet（內聯不跳頁，沿 C.4/C.10 Sheet 語言）。
 * 權限門（先解釋後調用，沿 `lib/camera` 分類口徑）→ 後置默認
 * （`facingMode ideal: environment`，無後置 graceful 降級）→ 拍攝
 * （canvas 烘焙濾鏡，所見即所得）→ 文字＋語音（本地收齊，E.2 才同步後端）。
 * 關 Sheet 即停流（攝像頭燈滅）；真磨皮／人臉貼紙不做（E.2，見 UR）。
 */
export function V2CameraSheet({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (shot: StagedShot) => void;
}) {
  const t2 = useTranslations("v2");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micTimerRef = useRef<number | null>(null);
  const micStartedAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ask");
  const [deniedKind, setDeniedKind] = useState<CameraErrorKind>("unknown");
  const [filterId, setFilterId] = useState<PhotoFilterId>("none");
  const [beauty, setBeauty] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [micState, setMicState] = useState<"idle" | "rec" | "done">("idle");
  const [micSeconds, setMicSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v !== null) v.srcObject = null;
    micRef.current = null;
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;
    if (micTimerRef.current !== null) {
      window.clearInterval(micTimerRef.current);
      micTimerRef.current = null;
    }
  }, []);

  const resetShot = useCallback(() => {
    setPhoto(null);
    setNote("");
    setMicState("idle");
    setMicSeconds(0);
    setAudioUrl(null);
  }, []);

  const start = useCallback(async () => {
    try {
      if (
        typeof navigator === "undefined" ||
        navigator.mediaDevices?.getUserMedia === undefined
      ) {
        setDeniedKind("no-device");
        setPhase("denied");
        return;
      }
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
      setPhase("live");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "Error";
      setDeniedKind(classifyGetUserMediaError(name));
      setPhase("denied");
    }
  }, []);

  // 取景掛載後掛流（start 只負責取流；video 節點 live 階段才掛載，
  // 取流時拿不到 ref——黑屏根因，掛載後補掛即亮）。
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

  // 新會話＝清上一拍（間接調用，effect 本體無 setState，合規）。
  const beginSession = useCallback(() => {
    resetShot();
    if (loadCameraConsent()) void start();
    else setPhase("ask");
  }, [resetShot, start]);

  useEffect(() => {
    if (!open) {
      stopTracks();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開門即新會話（清上一拍＋consent 直啟），關門只停流；沿 ChatThread 口徑
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
    setPhase("review");
  }

  function toggleMic(): void {
    if (micState === "rec") {
      micRef.current?.stop();
      return;
    }
    if (micState === "done") return;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        micStreamRef.current = stream;
        micChunksRef.current = [];
        const mr = new MediaRecorder(stream);
        micRef.current = mr;
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) micChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(micChunksRef.current, {
            type: mr.mimeType || "audio/webm",
          });
          const secs = Math.min(
            MAX_VOICE_SECONDS,
            Math.round((Date.now() - micStartedAtRef.current) / 1000),
          );
          setAudioUrl(URL.createObjectURL(blob));
          setMicSeconds(secs);
          setMicState("done");
          micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
          micStreamRef.current = null;
          if (micTimerRef.current !== null) {
            window.clearInterval(micTimerRef.current);
            micTimerRef.current = null;
          }
        };
        micStartedAtRef.current = Date.now();
        mr.start();
        setMicState("rec");
        setMicSeconds(0);
        micTimerRef.current = window.setInterval(() => {
          const s = Math.round((Date.now() - micStartedAtRef.current) / 1000);
          setMicSeconds(s);
          if (s >= MAX_VOICE_SECONDS) micRef.current?.stop();
        }, 500);
      } catch {
        setDeniedKind("unknown");
        setPhase("denied");
      }
    })();
  }

  function clearVoice(): void {
    setAudioUrl(null);
    setMicSeconds(0);
    setMicState("idle");
  }

  const liveCss = photoFilterCss(filterId, beauty);

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
            <Button onClick={() => void start()}>
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
              <Button variant="outline" size="sm" onClick={() => void start()}>
                {t2("camRetry")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X size={15} aria-hidden />
                {t2("cancel")}
              </Button>
            </div>
          </div>
        )}

        {phase === "live" && (
          <>
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

        {phase === "review" && photo !== null && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t2("camNotePh")}
              aria-label={t2("camNotePh")}
              className="max-h-24 w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex items-center gap-2">
              {micState === "idle" && (
                <Button variant="outline" size="sm" onClick={toggleMic}>
                  <Mic size={15} aria-hidden />
                  {t2("camVoice")} ({MAX_VOICE_SECONDS}s)
                </Button>
              )}
              {micState === "rec" && (
                <Button variant="destructive" size="sm" onClick={toggleMic}>
                  <Square size={14} aria-hidden className="fill-current" />
                  {t2("camVoiceStop")} · {micSeconds}s
                </Button>
              )}
              {micState === "done" && audioUrl !== null && (
                <>
                  <audio controls src={audioUrl} className="h-9 min-w-0 flex-1" />
                  <span className="shrink-0 text-xs text-muted-foreground">{micSeconds}s</span>
                  <Button variant="ghost" size="icon" aria-label={t2("camVoiceClear")} onClick={clearVoice}>
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => {
                  setPhoto(null);
                  setPhase("live");
                }}
              >
                <RotateCcw size={15} aria-hidden />
                {t2("camRetake")}
              </Button>
              <Button
                className="flex-1 rounded-full"
                onClick={() =>
                  onConfirm({
                    photoDataUrl: photo,
                    filterId,
                    note: note.trim(),
                    audioUrl,
                    audioSeconds: micSeconds,
                  })
                }
              >
                <Check size={15} aria-hidden />
                {t2("camConfirm")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
