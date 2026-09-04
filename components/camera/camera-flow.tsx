"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_NOTE_CHARS,
  classifyGetUserMediaError,
  formatClock,
  hasMediaDevices,
} from "@/lib/camera";
import { VoiceRecorder } from "./voice-recorder";

type Phase =
  | "intro"
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

/**
 * UR2.1 camera invoke + permission flow.
 *
 * Single entry screen (why + PDPO consent + entry choice in one go — one
 * explicit tap is the consent, still separate from the native prompt) →
 * requesting → live viewfinder, with denied / blocked / no-camera / upload
 * fallbacks. Capture ends in a lightweight `captured` confirmation
 * (thumbnail + retake); the UR2.2 review/input page takes over from there.
 */
export function CameraFlow() {
  const t = useTranslations("camera");
  const [phase, setPhase] = useState<Phase>("intro");
  const [photo, setPhoto] = useState<string | null>(null);
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<{ url: string; seconds: number } | null>(
    null,
  );
  const [receipt, setReceipt] = useState<{
    photo: string;
    note: string;
    audioSeconds: number | null;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Always release the camera on unmount.
  useEffect(() => {
    const ref = streamRef;
    return () => stopStream(ref.current);
  }, []);

  const toLive = useCallback((stream: MediaStream) => {
    stopStream(streamRef.current);
    streamRef.current = stream;
    setSource("camera");
    setPhase("live");
    // NOTE: the <video> element only mounts once phase === "live", so the
    // stream is attached in the effect below — attaching here would hit a
    // null ref and leave a black viewfinder (fixed 2026-09-04).
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
    if (!hasMediaDevices()) {
      setPhase("no-camera");
      return;
    }
    void requestCamera();
  }, [requestCamera]);

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
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhoto(URL.createObjectURL(file));
    setSource("upload");
    setPhase("review");
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    setSource("camera");
    setPhase("review");
  }, []);

  const clearAudio = useCallback(() => {
    setAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const submit = useCallback(() => {
    if (!photo) return;
    setReceipt({
      photo,
      note: note.trim(),
      audioSeconds: audio?.seconds ?? null,
    });
    setPhase("received");
  }, [photo, note, audio]);

  const restart = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setPhoto((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    clearAudio();
    setSource(null);
    setNote("");
    setReceipt(null);
    setPhase("intro");
  }, [clearAudio]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
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

      {phase === "review" && photo && (
        <section
          aria-labelledby="camera-review-title"
          className="flex flex-col gap-5"
        >
          <h1 id="camera-review-title" className="sr-only">
            {t("reviewTitle")}
          </h1>
          <div className="overflow-hidden rounded-2xl border-2 bg-card text-card-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={t("previewAlt")}
              className="aspect-[3/4] w-full object-cover"
            />
            <div className="flex flex-wrap items-center gap-3 p-4 md:p-6">
              <Button size="sm" variant="outline" onClick={retake}>
                {t(source === "camera" ? "retake" : "reselect")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  source === "camera"
                    ? fileRef.current?.click()
                    : void requestCamera()
                }
              >
                {t(source === "camera" ? "useUpload" : "openCamera")}
              </Button>
            </div>
          </div>

          <div className="relative rounded-2xl border-2 bg-card p-4 pt-6 text-card-foreground md:p-5 md:pt-7">
            <div
              aria-hidden
              className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-(--tape)"
            />
            <label
              htmlFor="camera-note"
              className="font-hand flex items-center gap-2 text-2xl font-bold"
            >
              <PencilLine className="size-5" aria-hidden />
              {t("notesLabel")}
            </label>
            <textarea
              id="camera-note"
              rows={4}
              maxLength={MAX_NOTE_CHARS}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notesPlaceholder")}
              className={cn(
                "mt-2 w-full bg-transparent text-base leading-7",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--ring)",
                "[background-image:repeating-linear-gradient(transparent_0,transparent_27px,var(--border)_27px,var(--border)_28px)]",
                "[background-attachment:local]",
              )}
            />
            <p className="font-hand text-muted-foreground mt-1 text-right text-lg leading-none">
              {t("charsLeft", {
                n: MAX_NOTE_CHARS - note.length,
              })}
            </p>
          </div>

          <VoiceRecorder
            onComplete={(url, seconds) => setAudio({ url, seconds })}
            onClear={clearAudio}
          />

          <Button
            onClick={submit}
            className={cn(
              "h-auto w-full rounded-full border-2 py-4 text-xl font-bold",
              "shadow-[4px_4px_0_var(--border)]",
              "motion-safe:transition-all motion-safe:hover:-translate-y-0.5",
              "motion-safe:hover:shadow-[6px_6px_0_var(--border)]",
              "motion-safe:active:translate-x-[2px] motion-safe:active:translate-y-[2px]",
              "motion-safe:active:shadow-none",
            )}
          >
            {t("submit")}
            <ArrowRight className="size-6" aria-hidden />
          </Button>
        </section>
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
              {t("receiptAudio")}:{" "}
              {receipt.audioSeconds !== null
                ? t("audioLength", {
                    t: formatClock(receipt.audioSeconds),
                  })
                : t("noAudio")}
            </p>
          </div>
          <div className="mt-6">
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
