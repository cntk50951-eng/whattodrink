"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronLeft, Flag, Flame, Trash2 } from "lucide-react";

import {
  deleteMyPost,
  loadWall,
  persistPost,
  sortHot,
  toggleLike,
} from "@/lib/posts";
import type { WallPost } from "@/lib/posts";
import { VoicePlayer } from "./PostDetail";
import styles from "./wall.module.css";

/**
 * UR4.1 v3 地圖互動榜（推倒下方區塊後的新家）：右上浮卡，平時只露
 * #1 縮圖＋榜名＋live 點；點開向下拉出榜單＋行內讚。
 * v4：點貼文不再跳頁——下拉內切詳情視圖（大圖＋正文＋語音＋讚＋
 * 檢舉／自刪），瀏覽操作全留在地圖上。
 * v7：去跳轉——「看全部」改下拉內下滑加載更多（初顯 3，點一次多 5，
 * 面板內滾動）；/wall 路由保留但榜不再導過去。
 * pick sheet 蓋上來自動收回，不跟抽屜打架。數據沿舊配方
 * （掛載＋回焦重讀，不偽造跳動）。
 */
const BOARD_PAGE = 5;
/** 下拉初顯條數（v7 去跳轉：不夠滑再按載入更多）。 */
const BOARD_INITIAL = 3;

export function MapHotBoard({ sheetOpen }: { sheetOpen: boolean }) {
  const t = useTranslations("wall");
  const tb = useTranslations("stubs");
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(BOARD_INITIAL);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"report" | "delete" | null>(null);

  const refresh = useCallback(() => {
    setPosts(sortHot(loadWall(), Date.now()));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  useEffect(() => {
    if (!sheetOpen) return;
    void Promise.resolve().then(() => {
      setOpen(false);
      setDetailId(null);
      setConfirm(null);
    });
  }, [sheetOpen]);

  if (posts === null || posts.length === 0) return null;
  const first = posts[0] as WallPost;
  const detail: WallPost | null =
    detailId === null ? null : (posts.find((p) => p.id === detailId) ?? null);

  const doLike = (id: string) => {
    setPosts((prev) => {
      if (!prev) return prev;
      const next = prev.map((p) => (p.id === id ? toggleLike(p) : p));
      const changed = next.find((p) => p.id === id);
      if (changed) persistPost(changed);
      return next;
    });
  };

  /** 檢舉／自刪後貼文離榜、詳情退回列表，全程不跳頁。 */
  const removePost = (id: string) => {
    setPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setDetailId(null);
    setConfirm(null);
  };
  const doReport = (post: WallPost) => {
    persistPost({ ...post, reported: true });
    removePost(post.id);
  };
  const doDelete = (id: string) => {
    deleteMyPost(id);
    removePost(id);
  };

  return (
    <div
      className={`${styles.wallIn} absolute top-24 right-3 z-[1000] ${
        detail === null ? "w-44" : "w-72 max-w-[78vw]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t("collapseBoard") : t("expandBoard")}
        className="flex w-full items-center gap-2 rounded-2xl border-2 bg-card/95 p-2 text-left shadow-[3px_3px_0_var(--border)] backdrop-blur-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={first.photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute right-0.5 bottom-0.5 flex h-2.5 w-2.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
            <span className="h-2.5 w-2.5 rounded-full border border-white bg-red-500" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-hand flex items-center gap-1 text-sm leading-tight font-bold">
            <Flame size={13} aria-hidden className="shrink-0 text-(--doodle-red)" />
            <span className="truncate">{t("homeTitle")}</span>
          </span>
          <span className="text-muted-foreground block truncate text-[11px]">
            {t("likes", { n: first.likes })}
          </span>
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          className={`shrink-0 transition-transform motion-safe:duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-all motion-safe:duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-2 max-h-[46vh] overflow-y-auto rounded-2xl border-2 bg-card/95 p-2 shadow-[3px_3px_0_var(--border)] backdrop-blur-sm">
            {detail === null ? (
              <>
                {posts.slice(0, limit).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-2 rounded-xl p-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setConfirm(null);
                        setDetailId(post.id);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-label={post.author.me ? t("you") : post.author.nickname}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.photo}
                        alt=""
                        loading="lazy"
                        className="h-9 w-9 shrink-0 rounded-lg border-2 object-cover"
                      />
                      <span className="truncate text-xs font-bold">
                        {post.author.me ? t("you") : post.author.nickname}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => doLike(post.id)}
                      aria-pressed={post.likedByMe}
                      aria-label={t("likes", { n: post.likes })}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-1.5 py-0.5 text-[11px] font-bold transition-transform active:scale-90 ${
                        post.likedByMe ? "bg-[#ffd9e2]" : "bg-card"
                      }`}
                    >
                      <span key={post.likes} className={styles.likePop} aria-hidden>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3"
                          fill={post.likedByMe ? "#d6336c" : "none"}
                          stroke="#7b1e26"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20 Q4 15 4 9 Q4 5 8 5 Q10 5 12 8 Q14 5 16 5 Q20 5 20 9 Q20 15 12 20 Z" />
                        </svg>
                      </span>
                      {post.likes}
                    </button>
                  </div>
                ))}
                {limit < posts.length && (
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + BOARD_PAGE)}
                    className="font-hand mt-1 block w-full rounded-xl border-2 border-dashed px-2 py-1.5 text-center text-sm font-bold"
                  >
                    {t("loadMore")}
                  </button>
                )}
              </>
            ) : (
              <div className={styles.wallIn} key={detail.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailId(null);
                    setConfirm(null);
                  }}
                  className="font-hand mb-1.5 inline-flex items-center gap-0.5 text-sm font-bold"
                >
                  <ChevronLeft size={15} aria-hidden />
                  {tb("back")}
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detail.photo}
                  alt=""
                  className="aspect-[4/3] w-full rounded-xl border-2 object-cover"
                />
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full border bg-card text-sm"
                  >
                    {detail.author.avatarEmoji}
                  </span>
                  <span className="truncate text-xs font-bold">
                    {detail.author.me ? t("you") : detail.author.nickname}
                  </span>
                </div>
                {detail.note !== "" && (
                  <p className="mt-1 text-xs leading-relaxed">{detail.note}</p>
                )}
                {detail.transcript !== "" && (
                  <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                    {t("voiceTranscript")}：{detail.transcript}
                  </p>
                )}
                {detail.audioSeconds !== null && (
                  <div className="mt-1.5">
                    <VoicePlayer
                      postId={detail.id}
                      seconds={detail.audioSeconds}
                      dataUrl={detail.audioDataUrl}
                      playLabel={t("play")}
                      pauseLabel={t("pause")}
                      small
                    />
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => doLike(detail.id)}
                    aria-pressed={detail.likedByMe}
                    aria-label={t("likes", { n: detail.likes })}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold transition-transform active:scale-90 ${
                      detail.likedByMe ? "bg-[#ffd9e2]" : "bg-card"
                    }`}
                  >
                    <span key={detail.likes} className={styles.likePop} aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill={detail.likedByMe ? "#d6336c" : "none"}
                        stroke="#7b1e26"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20 Q4 15 4 9 Q4 5 8 5 Q10 5 12 8 Q14 5 16 5 Q20 5 20 9 Q20 15 12 20 Z" />
                      </svg>
                    </span>
                    {detail.likes}
                  </button>
                  {detail.author.me ? (
                    confirm === "delete" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => doDelete(detail.id)}
                          className="rounded-full border-2 bg-(--doodle-red) px-2 py-0.5 text-white"
                        >
                          {t("delete")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm(null)}
                          className="rounded-full border-2 bg-card px-2 py-0.5"
                        >
                          {t("cancel")}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirm("delete")}
                        aria-label={t("delete")}
                        className="inline-flex items-center gap-1 rounded-full border-2 bg-card px-2 py-0.5 text-[11px] font-bold"
                      >
                        <Trash2 size={11} aria-hidden />
                        {t("delete")}
                      </button>
                    )
                  ) : confirm === "report" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => doReport(detail)}
                        className="rounded-full border-2 bg-(--doodle-red) px-2 py-0.5 text-white"
                      >
                        {t("reportYes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(null)}
                        className="rounded-full border-2 bg-card px-2 py-0.5"
                      >
                        {t("cancel")}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirm("report")}
                      aria-label={t("report")}
                      className="inline-flex items-center gap-1 rounded-full border-2 bg-card px-2 py-0.5 text-[11px] font-bold"
                    >
                      <Flag size={11} aria-hidden />
                      {t("report")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
