import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_VOICE_SECONDS, formatClock } from "@/lib/camera";

/**
 * UR2.2 voice note input — modern voice-pill UI in the doodle brand.
 *
 * idle: big round mic button + label + max-length hint.
 * recording: stop button + live timer + honest 60s progress track
 *   (thin line + knob, no fake waveform) + text status + pulsing ring.
 * done: custom play/pause + duration + rerecord; transcription is UR2.3.
 *
 * AC4: recording state is text + shape + motion (never color-only),
 * announced via aria-live; everything is a native <button>.
 */
export function VoiceRecorder({
  onComplete,
  onClear,
}: {
  onComplete: (audioUrl: string, seconds: number) => void;
  onClear: () => void;
}) {
  const t = useTranslations("camera");
  const [status, setStatus] = useState<
    "idle" | "recording" | "denied" | "no-mic" | "done"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Release mic + timer on unmount.
  useEffect(() => stopTracks, [stopTracks]);

  const finish = useCallback(
    (recorder: MediaRecorder, url: string, secs: number) => {
      stopTracks();
      setAudioUrl(url);
      setStatus("done");
      onComplete(url, secs);
    },
    [onComplete, stopTracks],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const elapsed = Math.min(
      MAX_VOICE_SECONDS,
      Math.round((Date.now() - startedAtRef.current) / 1000),
    );
    setSeconds(elapsed);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      finish(recorder, URL.createObjectURL(blob), elapsed);
    };
    recorder.stop();
  }, [finish]);

  const start = useCallback(async () => {
    setStatus("idle");
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({
        audio: true,
      });
      if (!stream) {
        setStatus("no-mic");
        return;
      }
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setStatus("recording");
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        setSeconds(Math.min(elapsed, MAX_VOICE_SECONDS));
        if (elapsed >= MAX_VOICE_SECONDS) stop();
      }, 500);
      recorder.start();
    } catch (err) {
      setStatus(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "denied"
          : "no-mic",
      );
    }
  }, [stop]);

  const rerecord = useCallback(() => {
    setPlaying(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSeconds(0);
    onClear();
    void start();
  }, [audioUrl, onClear, start]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, []);

  const progress = Math.min(100, (seconds / MAX_VOICE_SECONDS) * 100);

  return (
    <div className="relative rounded-2xl border-2 bg-card p-4 text-card-foreground md:p-5">
      <div className="flex items-center gap-4">
        {status === "recording" ? (
          <button
            type="button"
            onClick={stop}
            aria-label={t("recordStop")}
            className={cn(
              "relative flex size-16 shrink-0 items-center justify-center rounded-full",
              "bg-(--doodle-red) text-white transition-transform",
              "motion-safe:active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-(--doodle-red) motion-safe:animate-ping"
            />
            <Square className="size-6 fill-current" aria-hidden />
          </button>
        ) : status === "done" && audioUrl ? (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? t("pauseAudio") : t("playAudio")}
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-full",
              "bg-(--foreground) text-(--background) transition-transform",
              "motion-safe:active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            {playing ? (
              <Pause className="size-6 fill-current" aria-hidden />
            ) : (
              <Play className="size-6 fill-current" aria-hidden />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            aria-label={t("recordStart")}
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-full",
              "bg-(--foreground) text-(--background) transition-transform",
              "motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <Mic className="size-6" aria-hidden />
          </button>
        )}

        <div className="min-w-0 flex-1" aria-live="polite">
          {status === "recording" ? (
            <>
              <p className="font-hand text-2xl font-bold tabular-nums">
                {formatClock(seconds)}
                <span className="text-muted-foreground ml-2 align-middle text-sm font-normal">
                  {t("recordingMax", {
                    max: formatClock(MAX_VOICE_SECONDS),
                  })}
                </span>
              </p>
              <div
                className="relative mt-2 h-1 rounded-full bg-(--border)/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={MAX_VOICE_SECONDS}
                aria-valuenow={seconds}
              >
                <div
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--doodle-red)"
                  style={{ left: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-semibold tracking-wide text-(--doodle-red) uppercase">
                {t("recordingTag")}
              </p>
            </>
          ) : status === "done" ? (
            <>
              <p className="font-hand text-2xl font-bold tabular-nums">
                {formatClock(seconds)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("transcriptPending")}
              </p>
            </>
          ) : (
            <>
              <p className="font-hand text-2xl font-bold">{t("voiceLabel")}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("voiceHint", { max: formatClock(MAX_VOICE_SECONDS) })}
              </p>
            </>
          )}
        </div>

        {status === "done" && (
          <button
            type="button"
            onClick={rerecord}
            aria-label={t("rerecord")}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border-2",
              "transition-transform motion-safe:active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)",
            )}
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {status === "done" && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          className="sr-only"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      {(status === "denied" || status === "no-mic") && (
        <div className="mt-3 flex flex-col gap-3 border-t-2 border-dashed pt-3">
          <p className="text-muted-foreground text-sm">
            {t(status === "denied" ? "micDenied" : "micNoDevice")}
          </p>
          <div>
            <Button size="sm" variant="outline" onClick={() => void start()}>
              {t("retry")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
