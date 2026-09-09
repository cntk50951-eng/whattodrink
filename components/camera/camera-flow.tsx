"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ImagePlus,
  Camera as CameraIcon,
  Mic,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_NOTE_CHARS,
  classifyGetUserMediaError,
  formatClock,
  hasMediaDevices,
  loadCameraConsent,
  saveCameraConsent,
} from "@/lib/camera";
import {
  fitAudioDataUrl,
  loadMyPosts,
  newPostId,
  ownPostAudioUrl,
  saveMyPosts,
} from "@/lib/posts";
import type { WallPost } from "@/lib/posts";
import { MOCK_ME } from "@/lib/me";
import { recordingToWavBase64 } from "@/lib/audio";
import { VoiceRecorder } from "./voice-recorder";

type TransState = {
  status: "idle" | "working" | "done" | "error" | "empty";
  text: string;
};

type Phase =
  | "intro"
  | "consent"
  | "requesting"
  | "live"
  | "denied"
  | "blocked"
  | "no-camera"
  | "upload"
  | "review"
  | "received";

type PhotoSource = "camera" | "upload";

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** browser-only：Blob → dataURL（語音持久化用）。 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

/**
 * UR4.1 上傳下採樣（browser-only）：File → ≤1024px JPEG dataURL。
 * 解碼失敗時 reject，調用方退回 object URL。
 */
function fileToPhotoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas
        .getContext("2d")
        ?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

/**
 * UR2.1 camera invoke + permission flow.
 *
 * Single entry screen (why + PDPO consent + entry choice in one go — one
 * explicit tap is the consent, still separate from the native prompt) →
 * requesting → live viewfinder, with denied / blocked / no-camera / upload
 * fallbacks. Capture ends in a lightweight `captured` confirmation
 * (thumbnail + retake); the UR2.2 review/input page takes over from there.
 */
export function CameraFlow({
  autoStart = false,
  onClose,
}: {
  autoStart?: boolean;
  /**
   * 地圖 overlay 模式才給：各階段 X／成功頁回家都走這裡關層
   * （卸載即停流，見 unmount effect）。不給＝獨立 /camera 頁，沿舊行為。
   */
  onClose?: () => void;
}) {
  const t = useTranslations("camera");
  const [phase, setPhase] = useState<Phase>(autoStart ? "consent" : "intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<{ url: string; seconds: number } | null>(
    null,
  );
  const [receipt, setReceipt] = useState<{
    photo: string;
    note: string;
    transcript: string;
    audioSeconds: number | null;
  } | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [trans, setTrans] = useState<TransState>({ status: "idle", text: "" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Always release the camera on unmount.
  useEffect(() => {
    const ref = streamRef;
    return () => stopStream(ref.current);
  }, []);

  const router = useRouter();
  /* 黑屏根因（2026-09-09 用戶回報：權限開了仍全黑，v1 正常）：
   * ?auto=1 在 dev StrictMode double-mount／連點下會開兩個流，
   * 後到的 toLive 停掉先到的 track，而 <video> 掛的正是先到的——
   * 有權限、有流、畫面黑。兩道閘：auto 只開一次＋舊世代決議作廢。 */
  const autoBegan = useRef(false);
  const reqGen = useRef(0);

  const toLive = useCallback((stream: MediaStream) => {
    stopStream(streamRef.current);
    streamRef.current = stream;
    setSource("camera");
    setPhase("live");
    // NOTE: the <video> element only mounts once phase === "live", so the
    // stream is attached in the effect below — attaching here would hit a
    // null ref and leave a black viewfinder (fixed 2026-09-04).
    // 世代守衛的另一半（2026-09-09 黑屏返工）：贏家後到時 attach effect
    // 因 phase 同值不重跑，video 仍掛舊流——此處若 video 已在，直接重綁。
    const video = videoRef.current;
    if (video !== null) {
      video.muted = true;
      video.srcObject = stream;
      void video.play().catch(() => {
        /* autoplay blocked — user can press play */
      });
    }
  }, []);

  // Attach the live stream once the viewfinder has mounted.
  useEffect(() => {
    if (phase !== "live") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.muted = true; // set via property — the JSX muted attr is unreliable
    video.srcObject = stream;
    void video.play().catch(() => {
      /* autoplay blocked — user can press play */
    });
  }, [phase]);

  const requestCamera = useCallback(async () => {
    setPhase("requesting");
    const gen = ++reqGen.current;
    try {
      // Browser-level permanent block? Show settings guidance (not retry).
      try {
        const status = await navigator.permissions?.query({
          name: "camera" as PermissionName,
        });
        if (status?.state === "denied") {
          setPhase("blocked");
          return;
        }
      } catch {
        /* Permissions API unavailable — fall through to getUserMedia */
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      // 世代已過（ StrictMode／連點又開了一次）：殺掉自己的流，當沒發生過。
      if (gen !== reqGen.current) {
        stopStream(stream);
        return;
      }
      toLive(stream);
    } catch (err) {
      const kind = classifyGetUserMediaError(
        err instanceof DOMException ? err.name : "unknown",
      );
      if (kind === "no-device") {
        setPhase("no-camera");
        return;
      }
      // A fresh denial may already be persisted as a block — check again.
      try {
        const status = await navigator.permissions?.query({
          name: "camera" as PermissionName,
        });
        setPhase(status?.state === "denied" ? "blocked" : "denied");
      } catch {
        setPhase("denied");
      }
    }
  }, [toLive]);

  const begin = useCallback(() => {
    // The explicit tap on "open camera" doubles as the PDPO consent.
    saveCameraConsent();
    if (!hasMediaDevices()) {
      setPhase("no-camera");
      return;
    }
    void requestCamera();
  }, [requestCamera]);

  // UR4.1 ?auto=1：跳過 intro。首用先看一張說明卡（consent 相），
  // 回頭客直達鏡頭。放 begin 之後（TDZ），microtask 包一層，
  // set-state-in-effect 保持安靜。autoBegan 擋 StrictMode double-mount
  // 的第二次（refs 在模擬 remount 間保留，見黑屏根因註）。
  useEffect(() => {
    if (!autoStart || autoBegan.current) return;
    autoBegan.current = true;
    void Promise.resolve().then(() => {
      if (loadCameraConsent()) begin();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retake = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhoto((prev) => {
      if (prev && source === "upload") URL.revokeObjectURL(prev);
      return null;
    });
    setSource(null);
    void requestCamera();
  }, [requestCamera, source]);

  const chooseUpload = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhase("upload");
  }, []);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    // UR4.1 上傳同樣下採樣；解碼失敗（HEIC 等）退回 object URL，
    // 會話內可看可分享，reload 後 parse 擋掉（不進牆，不炸配額）。
    void fileToPhotoDataUrl(file)
      .catch(() => URL.createObjectURL(file))
      .then((url) => {
        setPhoto((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setPhoto(url);
        setSource("upload");
        setPhase("review");
      });
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    // UR4.1 下採樣：最長邊 ≤1024px（localStorage 5MB 保命，牆縮圖夠用）。
    const scale = Math.min(
      1,
      1024 / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhoto(canvas.toDataURL("image/jpeg", 0.82));
    setSource("camera");
    setPhase("review");
  }, []);

  const clearAudio = useCallback(() => {
    setAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setAudioBlob(null);
    setTrans({ status: "idle", text: "" });
  }, []);

  /* UR4.1 社交 composer：語音列平時收成一顆附件 chip，點開才展開錄音機。 */
  const [voiceOpen, setVoiceOpen] = useState(false);
  const handleVoiceClear = useCallback(() => {
    clearAudio();
    setVoiceOpen(false);
  }, [clearAudio]);

  const runTranscription = useCallback(async (blob: Blob) => {
    setTrans({ status: "working", text: "" });
    try {
      const audioBase64 = await recordingToWavBase64(blob);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64 }),
      });
      const data: { text?: string; code?: string } = await res.json();
      const text = (data.text ?? "").trim();
      // Empty transcript = unrecognised (AC3 path); HTTP/API failures
      // surface as error — either way the user can retry or just type.
      setTrans(text ? { status: "done", text } : { status: "empty", text: "" });
    } catch {
      setTrans({ status: "error", text: "" });
    }
  }, []);

  const handleAudioComplete = useCallback(
    (url: string, seconds: number, blob: Blob) => {
      setAudio({ url, seconds });
      setAudioBlob(blob);
      void runTranscription(blob);
    },
    [runTranscription],
  );

  const retryTranscription = useCallback(() => {
    if (audioBlob) void runTranscription(audioBlob);
  }, [audioBlob, runTranscription]);

  // UR4.1 分享進牆：落 localStorage（沿 wantRecord 配方）→ 直達詳情。
  // 語音小段（≤400KB）順手存 dataURL，reload 後還能播；存不下只活會話。
  const submit = useCallback(() => {
    if (!photo) return;
    const id = newPostId();
    // 空包不算錄過（v5 遺毒：0-byte 也存秒數，牆上播出 416）。
    const clip =
      audioBlob !== null && audioBlob.size > 0 ? audioBlob : null;
    void (async () => {
      let audioDataUrl: string | null = null;
      if (clip) {
        try {
          audioDataUrl = fitAudioDataUrl(await blobToDataUrl(clip));
        } catch {
          /* 讀不出就只活會話（既定口徑），不擋分享。 */
        }
      }
      const post: WallPost = {
        id,
        photo,
        note: note.trim(),
        audioSeconds: clip !== null ? (audio?.seconds ?? null) : null,
        audioDataUrl,
        transcript: trans.status === "done" ? trans.text.trim() : "",
        likes: 0,
        likedByMe: false,
        createdAt: Date.now(),
        author: {
          nickname: "我",
          avatarEmoji: MOCK_ME.avatarEmoji,
          gender: "secret" as const,
          me: true as const,
        },
        reported: false,
      };
      saveMyPosts([post, ...loadMyPosts()]);
      // 牆自有 URL：跟 composer 的錄音 URL 脫鉤，重錄／再來一張 revoke 不到這條。
      if (clip) ownPostAudioUrl(id, clip);
      setReceipt({
        photo,
        note: post.note,
        transcript: post.transcript,
        audioSeconds: post.audioSeconds,
      });
      // overlay 模式留地圖：成功頁在層內續播；獨立頁才跳詳情。
      if (onClose) setPhase("received");
      else router.push(`/wall/${id}`);
    })();
  }, [photo, note, audio, audioBlob, trans, router, onClose]);

  const restart = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhoto((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    clearAudio();
    setAudioBlob(null);
    setTrans({ status: "idle", text: "" });
    setSource(null);
    setNote("");
    setReceipt(null);
    setPhase("intro");
  }, [clearAudio]);

  /**
   * 關層統一口：停流清稿（restart）＋ overlay 模式再卸載。
   * 獨立頁無 onClose，X 回 intro（沿舊行為）；overlay 直接回地圖。
   */
  const exitAll = useCallback(() => {
    restart();
    onClose?.();
  }, [restart, onClose]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {onClose && phase !== "review" && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={exitAll}
            aria-label={t("closeReview")}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card text-card-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
      {phase === "intro" && (
        <section
          aria-labelledby="camera-intro-title"
          className="relative overflow-hidden rounded-2xl border-2 bg-card p-6 text-card-foreground md:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-4 -right-4 w-28 opacity-90 select-none"
          >
            <svg viewBox="0 0 100 100" width="100%">
              <g
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M30 38 L28 72 Q28 78 34 78 L66 78 Q72 78 72 72 L70 38 Z"
                  fill="var(--card)"
                />
                <path
                  d="M26 38 Q25 26 36 24 Q40 16 50 21 Q60 14 68 22 Q76 20 74 38 Z"
                  fill="var(--card)"
                />
                <path
                  d="M32 50 L30 70 Q30 75 35 75 L65 75 Q70 75 70 70 L68 50 Z"
                  fill="var(--primary)"
                  strokeWidth="2"
                />
                <path d="M72 46 Q84 46 84 58 Q84 70 72 70" />
              </g>
            </svg>
          </div>
          <p className="font-hand text-xl text-(--doodle-red)">
            {t("introEyebrow")}
          </p>
          <h1
            id="camera-intro-title"
            className="font-hand mt-2 max-w-[12ch] text-4xl font-bold tracking-tight text-balance md:text-5xl"
          >
            {t("introTitle")}
          </h1>
          <ul className="mt-5 flex flex-col gap-2 text-sm leading-relaxed md:text-base">
            <li className="flex gap-2">
              <span aria-hidden className="font-hand text-lg text-(--doodle-red)">
                ✓
              </span>
              <span>{t("introPoint1")}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="font-hand text-lg text-(--doodle-red)">
                ✓
              </span>
              <span>{t("introPoint2")}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="font-hand text-lg text-(--doodle-red)">
                ✓
              </span>
              <span>{t("introPoint3")}</span>
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={begin}>
              {t("openCamera")}
            </Button>
            <Button size="lg" variant="outline" onClick={chooseUpload}>
              {t("useUpload")}
            </Button>
          </div>
          <p className="font-hand text-muted-foreground mt-4 text-lg">
            {t("introNote")}
          </p>
        </section>
      )}

      {/* UR4.1 首用說明卡（?auto=1 首訪）：一句話＋同意，不自動開鏡頭。 */}
      {phase === "consent" && (
        <section
          aria-labelledby="camera-consent-title"
          className="relative rounded-2xl border-2 bg-card p-6 pt-8 text-card-foreground md:p-8"
        >
          <div
            aria-hidden
            className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 bg-(--tape)"
          />
          <h1
            id="camera-consent-title"
            className="font-hand text-3xl font-bold tracking-tight md:text-4xl"
          >
            {t("consentTitle")}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed md:text-base">
            {t("consentBody")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={begin}>
              {t("consentAgree")}
            </Button>
            <Button size="lg" variant="outline" onClick={chooseUpload}>
              {t("useUpload")}
            </Button>
          </div>
        </section>
      )}

      {phase === "requesting" && (
        <div
          role="status"
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card p-10 text-center text-card-foreground"
        >
          <span
            aria-hidden
            className="font-hand text-6xl motion-safe:animate-pulse"
          >
            ~
          </span>
          <p className="text-muted-foreground">{t("requesting")}</p>
        </div>
      )}

      {phase === "live" && (
        <section
          aria-label={t("title")}
          className="overflow-hidden rounded-2xl border-2 bg-card text-card-foreground"
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-[3/4] w-full bg-black object-cover"
          />
          <div className="flex flex-wrap gap-3 p-4 md:p-6">
            <Button size="lg" onClick={capture}>
              {t("takePhoto")}
            </Button>
            <Button size="lg" variant="outline" onClick={chooseUpload}>
              {t("useUpload")}
            </Button>
          </div>
        </section>
      )}

      {(phase === "denied" || phase === "blocked") && (
        <section
          aria-labelledby="camera-denied-title"
          className="rounded-2xl border-2 bg-card p-6 text-card-foreground md:p-8"
        >
          <h1
            id="camera-denied-title"
            className="font-hand text-4xl font-bold tracking-tight md:text-5xl"
          >
            {t(phase === "blocked" ? "blockedTitle" : "deniedTitle")}
          </h1>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed whitespace-pre-line md:text-base">
            {t(phase === "blocked" ? "blockedBody" : "deniedBody")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {phase === "denied" && (
              <Button size="lg" onClick={() => void requestCamera()}>
                {t("retry")}
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={chooseUpload}>
              {t("useUpload")}
            </Button>
          </div>
        </section>
      )}

      {phase === "no-camera" && (
        <section
          aria-labelledby="camera-nocam-title"
          className="rounded-2xl border-2 border-dashed bg-card p-6 text-card-foreground md:p-8"
        >
          <h1
            id="camera-nocam-title"
            className="font-hand text-4xl font-bold tracking-tight md:text-5xl"
          >
            {t("noCameraTitle")}
          </h1>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">
            {t("noCameraBody")}
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={() => fileRef.current?.click()}>
              {t("chooseFile")}
            </Button>
          </div>
        </section>
      )}

      {phase === "upload" && (
        <section
          aria-labelledby="camera-upload-title"
          className="rounded-2xl border-2 border-dashed bg-card p-6 text-center text-card-foreground md:p-8"
        >
          <h1
            id="camera-upload-title"
            className="font-hand text-4xl font-bold tracking-tight md:text-5xl"
          >
            {t("uploadTitle")}
          </h1>
          <div className="mt-6">
            <Button size="lg" onClick={() => fileRef.current?.click()}>
              {t("chooseFile")}
            </Button>
          </div>
        </section>
      )}

      {/* UR4.1 全螢幕預覽：拍立得相框＋底部浮動分享條（AC2）。 */}
      {phase === "review" && photo && (
        <div className="fixed inset-0 z-[1200] overflow-y-auto bg-black/85 p-4">
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={exitAll}
            aria-label={t("closeReview")}
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card text-card-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <section
          aria-labelledby="camera-review-title"
          className="mx-auto flex w-full max-w-md flex-col gap-5"
        >
          <h1 id="camera-review-title" className="sr-only">
            {t("reviewTitle")}
          </h1>
          {/* 1. 照片 hero：重拍／換源收成角落圓鈕，不再佔一整行。 */}
          <div className="relative overflow-hidden rounded-2xl border-2 bg-card text-card-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={t("previewAlt")}
              className="aspect-[3/4] w-full object-cover"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={retake}
                aria-label={t(source === "camera" ? "retake" : "reselect")}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <RotateCcw size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() =>
                  source === "camera"
                    ? fileRef.current?.click()
                    : void requestCamera()
                }
                aria-label={t(source === "camera" ? "useUpload" : "openCamera")}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {source === "camera" ? (
                  <ImagePlus size={18} aria-hidden />
                ) : (
                  <CameraIcon size={18} aria-hidden />
                )}
              </button>
            </div>
          </div>

          {/* 2. caption 列：頭像＋行內輸入（社交範式，label 隱藏但可及）。 */}
          <div className="flex gap-3 rounded-2xl border-2 bg-card p-3 text-card-foreground">
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-accent text-accent-foreground shadow-[2px_2px_0_var(--border)]"
            >
              <UserRound size={22} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="camera-note" className="sr-only">
                {t("notesLabel")}
              </label>
              <textarea
                id="camera-note"
                rows={3}
                maxLength={MAX_NOTE_CHARS}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className={cn(
                  "w-full resize-none bg-transparent text-base leading-relaxed",
                  "placeholder:text-muted-foreground",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                )}
              />
              <p className="text-muted-foreground mt-1 text-right text-xs">
                {t("charsLeft", {
                  n: MAX_NOTE_CHARS - note.length,
                })}
              </p>
            </div>
          </div>

          {/* 3. 語音附件列：平時一顆 chip，有錄音才展開。 */}
          {!voiceOpen && !audio ? (
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-full border-2 border-dashed px-4 py-2 text-sm font-bold text-muted-foreground transition-transform active:scale-95"
            >
              <Mic size={16} aria-hidden />
              {t("voiceLabel")}
            </button>
          ) : (
            <VoiceRecorder
              onComplete={handleAudioComplete}
              onClear={handleVoiceClear}
            />
          )}

          {trans.status === "working" && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed bg-card p-4 text-card-foreground"
            >
              <span
                aria-hidden
                className="font-hand text-3xl motion-safe:animate-pulse"
              >
                ~
              </span>
              <p className="text-muted-foreground text-sm">
                {t("transcribing")}
              </p>
            </div>
          )}

          {trans.status === "done" && (
            <div className="rounded-2xl border-2 bg-card p-4 text-card-foreground md:p-5">
              <label
                htmlFor="camera-transcript"
                className="font-hand flex items-center gap-2 text-2xl font-bold"
              >
                {t("transcriptLabel")}
              </label>
              <textarea
                id="camera-transcript"
                rows={2}
                maxLength={MAX_NOTE_CHARS}
                value={trans.text}
                onChange={(e) =>
                  setTrans({ status: "done", text: e.target.value })
                }
                className={cn(
                  "mt-2 w-full rounded-xl border-2 bg-card p-3 text-sm leading-relaxed",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
                )}
              />
            </div>
          )}

          {(trans.status === "error" || trans.status === "empty") && (
            <div className="rounded-2xl border-2 border-dashed bg-card p-4 text-card-foreground">
              <p className="text-muted-foreground text-sm">
                {t(trans.status === "empty" ? "transcribeEmpty" : "transcribeError")}
              </p>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={retryTranscription}>
                  {t("transcribeRetry")}
                </Button>
              </div>
            </div>
          )}

          {/* 4. 黏底分享條：滾再長，分享永遠在手邊。 */}
          <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-black/70 to-transparent px-1 pt-6 pb-1">
          <Button
            onClick={submit}
            className={cn(
              "font-hand h-auto w-full rounded-full border-2 bg-accent py-4 text-xl font-bold text-accent-foreground",
              "shadow-[4px_4px_0_var(--border)]",
              "motion-safe:transition-all motion-safe:hover:-translate-y-0.5",
              "motion-safe:hover:shadow-[6px_6px_0_var(--border)]",
              "motion-safe:active:translate-x-[2px] motion-safe:active:translate-y-[2px]",
              "motion-safe:active:shadow-none",
            )}
          >
            {t("sharePost")}
            <ArrowRight className="size-6" aria-hidden />
          </Button>
          </div>
        </section>
        </div>
      )}

      {phase === "received" && receipt && (
        <section
          aria-labelledby="camera-received-title"
          className="rounded-2xl border-2 bg-card p-6 text-center text-card-foreground md:p-8"
        >
          <p aria-hidden className="font-hand text-6xl text-(--doodle-red)">
            ✓
          </p>
          <h1
            id="camera-received-title"
            className="font-hand mt-2 text-4xl font-bold tracking-tight md:text-5xl"
          >
            {t("receivedTitle")}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed md:text-base">
            {t("receivedBody")}
          </p>
          <div className="text-muted-foreground mx-auto mt-4 max-w-sm text-left text-sm">
            <p>
              {t("receiptNote")}:{" "}
              {receipt.note || t("noText")}
            </p>
            <p className="mt-1">
              {t("receiptTranscript")}:{" "}
              {receipt.transcript || t("noTranscript")}
            </p>
            <p className="mt-1">
              {t("receiptAudio")}:{" "}
              {receipt.audioSeconds !== null
                ? t("audioLength", {
                    t: formatClock(receipt.audioSeconds),
                  })
                : t("noAudio")}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => (onClose ? exitAll() : router.push("/"))}>
              {t("backHome")}
            </Button>
            <Button size="lg" variant="outline" onClick={restart}>
              {t("again")}
            </Button>
          </div>
        </section>
      )}

      {/* Shared file picker for upload / no-camera paths */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={t("chooseFile")}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
