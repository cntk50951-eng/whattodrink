"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flag, Mic, Pause, Play, Trash2 } from "lucide-react";

import { formatClock } from "@/lib/camera";
import {
  deleteMyPost,
  getPostAudioUrl,
  loadWall,
  persistPost,
  toggleLike,
} from "@/lib/posts";
import type { WallPost } from "@/lib/posts";
import styles from "./wall.module.css";

/* 24 根裝飾波形柱（播放進度只走時間，不做真頻譜——mock 誠實口徑）。 */
function waveBars(seed: string): number[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return Array.from({ length: 24 }, (_, i) => 6 + ((h + i * 37) % 22));
}

export function VoicePlayer({
  postId,
  seconds,
  dataUrl,
  playLabel,
  pauseLabel,
  small = false,
}: {
  postId: string;
  seconds: number;
  /** reload 後的後備（小段才有；都沒有就只剩秒數章）。 */
  dataUrl: string | null;
  playLabel: string;
  pauseLabel: string;
  /** 地圖榜詳情用小尺寸（按鈕 8、波形 16 柱）。 */
  small?: boolean;
}) {
  // 候選源按序試：會話 blob URL → 持久 dataURL；壞源（416／revoke）
  // onError 切下一個，全滅退回秒數章——牆上永遠不留死播放鈕。
  const sessionUrl = getPostAudioUrl(postId);
  const sources =
    sessionUrl !== null && sessionUrl !== dataUrl
      ? [sessionUrl, dataUrl]
      : [dataUrl];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(0);
  // 切貼文重置降級鏈（effect 內同步 set 撞 lint，沿既定口徑包 microtask）。
  useEffect(() => {
    void Promise.resolve().then(() => {
      setFailed(0);
      setPlaying(false);
      setElapsed(0);
    });
  }, [postId]);
  const url = sources[failed] ?? null;
  if (url === null) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <Mic size={14} aria-hidden />
        {formatClock(seconds)}
      </span>
    );
  }
  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) void el.pause();
    else void el.play().catch(() => setPlaying(false));
  };
  const bars = small ? waveBars(postId).slice(0, 16) : waveBars(postId);
  return (
    <span className={`inline-flex items-center ${small ? "gap-2" : "gap-3"}`}>
      <audio
        key={url}
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed((f) => f + 1)}
        onTimeUpdate={(e) => setElapsed(Math.floor(e.currentTarget.currentTime))}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? pauseLabel : playLabel}
        className={`font-hand flex shrink-0 items-center justify-center rounded-full border-2 bg-accent text-accent-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
          small ? "h-8 w-8" : "h-12 w-12"
        }`}
      >
        {playing ? (
          <Pause size={small ? 14 : 20} aria-hidden />
        ) : (
          <Play size={small ? 14 : 20} aria-hidden className="ml-0.5" />
        )}
      </button>
      <span aria-hidden className="flex h-8 items-end gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-(--border)"
            style={{ height: `${h}px` }}
          />
        ))}
      </span>
      <span
        className={`text-muted-foreground tabular-nums ${small ? "text-xs" : "text-sm"}`}
      >
        {formatClock(elapsed)}/{formatClock(seconds)}
      </span>
    </span>
  );
}

function LikeHeart({ liked }: { liked: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={liked ? "#d6336c" : "none"}
      stroke="#7b1e26"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20 Q4 15 4 9 Q4 5 8 5 Q10 5 12 8 Q14 5 16 5 Q20 5 20 9 Q20 15 12 20 Z" />
    </svg>
  );
}

/**
 * UR4.1 貼文詳情（畫面4）：大拍立得＋作者＋正文（無襯線）＋語音條＋
 * 輕讚（150ms pop）＋檢舉／自刪兩段確認。变更即 persistPost 落盤。
 */
export function PostDetail({ id }: { id: string }) {
  const t = useTranslations("wall");
  const router = useRouter();
  const [post, setPost] = useState<WallPost | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<"report" | "delete" | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setPost(loadWall().find((p) => p.id === id) ?? null);
    });
  }, [id]);

  if (post === undefined) return null;
  if (post === null) {
    return (
      <div className="rounded-2xl border-2 border-dashed bg-card p-8 text-center">
        <p className="font-hand text-2xl font-bold">{t("emptyTitle")}</p>
        <Link
          href="/wall"
          className="font-hand mt-4 inline-block rounded-full border-2 bg-card px-4 py-2 font-bold shadow-[2px_2px_0_var(--border)]"
        >
          {t("title")}
        </Link>
      </div>
    );
  }

  const doLike = () => {
    const next = toggleLike(post);
    setPost(next);
    persistPost(next);
  };
  const doReport = () => {
    const next = { ...post, reported: true };
    persistPost(next);
    router.push("/wall");
  };
  const doDelete = () => {
    deleteMyPost(post.id);
    router.push("/wall");
  };

  return (
    <article>
      <div className="relative rounded-2xl border-2 bg-[#fdfdf8] p-3 pb-4 shadow-[3px_3px_0_var(--border)]">
        <div
          aria-hidden
          className="absolute -top-3 left-8 h-6 w-20 -rotate-6 bg-(--tape)"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.photo}
          alt=""
          className="aspect-[3/4] w-full rounded-lg object-cover"
        />
        <div className="mt-3 flex items-center gap-2 px-1">
          <span aria-hidden className="text-2xl">
            {post.author.avatarEmoji}
          </span>
          <span className="font-bold">
            {post.author.me ? t("you") : post.author.nickname}
          </span>
          <span className="text-muted-foreground ml-auto text-xs">
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {post.note !== "" && (
        <p className="mt-4 text-base leading-relaxed">{post.note}</p>
      )}

      {post.transcript !== "" && (
        <div className="mt-3 rounded-2xl border-2 border-dashed bg-card p-3 text-sm">
          <p className="font-hand text-lg font-bold">{t("voiceTranscript")}</p>
          <p className="mt-1 leading-relaxed">{post.transcript}</p>
        </div>
      )}

      {post.audioSeconds !== null && (
        <div className="mt-3">
          <VoicePlayer
            postId={post.id}
            seconds={post.audioSeconds}
            dataUrl={post.audioDataUrl}
            playLabel={t("play")}
            pauseLabel={t("pause")}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={doLike}
          aria-pressed={post.likedByMe}
          aria-label={t("likes", { n: post.likes })}
          className={`font-hand inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-lg font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
            post.likedByMe ? "bg-[#ffd9e2]" : "bg-card"
          }`}
        >
          <span key={post.likes} className={styles.likePop} aria-hidden>
            <LikeHeart liked={post.likedByMe} />
          </span>
          {t("likes", { n: post.likes })}
        </button>

        {post.author.me ? (
          confirm === "delete" ? (
            <>
              <button
                type="button"
                onClick={doDelete}
                className="font-hand rounded-full border-2 bg-red-500 px-4 py-2 font-bold text-white shadow-[2px_2px_0_var(--border)]"
              >
                {t("delete")}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="font-hand rounded-full border-2 px-4 py-2 font-bold"
              >
                {t("cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("delete")}
              className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-bold"
            >
              <Trash2 size={15} aria-hidden />
              {t("delete")}
            </button>
          )
        ) : confirm === "report" ? (
          <>
            <span className="text-sm font-bold">{t("reportTitle")}</span>
            <button
              type="button"
              onClick={doReport}
              className="font-hand rounded-full border-2 bg-red-500 px-4 py-2 font-bold text-white shadow-[2px_2px_0_var(--border)]"
            >
              {t("reportYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="font-hand rounded-full border-2 px-4 py-2 font-bold"
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirm("report")}
            className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-bold"
          >
            <Flag size={15} aria-hidden />
            {t("report")}
          </button>
        )}
      </div>
    </article>
  );
}
