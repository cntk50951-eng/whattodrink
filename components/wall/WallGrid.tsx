"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Flame, Mic, Sparkles } from "lucide-react";

import {
  loadWall,
  loadWallSeenAt,
  saveWallSeenAt,
  sortHot,
  sortLatest,
} from "@/lib/posts";
import type { WallPost } from "@/lib/posts";
import styles from "./wall.module.css";

const WALL_GUIDE_KEY = "wtd-wall-guide-seen";
/* 定妝旋轉（同卡永同角）＋獎章色（金／銀／銅）。 */
const TILE_SPIN = [-3, 2, -2, 4, -4, 3, -1, 5];
const RANK_COLORS = ["#e6a817", "#b9c2cc", "#b0713a"];

type Tab = "hot" | "latest";

function loadGuideSeen(): boolean {
  try {
    return localStorage.getItem(WALL_GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * UR4.1 公開牆（畫面3）：拍立得縮圖散牆＋讚徽章＋類型角標，
 * 熱門／最新貼紙頁籤；首訪浮一張守則小卡；掛載即記已讀（選單紅點滅）。
 */
export function WallGrid() {
  const t = useTranslations("wall");
  const [tab, setTab] = useState<Tab>("hot");
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  /* 熱門排序的 now 快照——render 裡禁 Date.now.，mount 取一次。 */
  const [now, setNow] = useState(0);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const wall = loadWall();
      const seen = loadWallSeenAt();
      setPosts(wall);
      setSeenAt(seen);
      setNow(Date.now());
      setGuideOpen(!loadGuideSeen());
      saveWallSeenAt(Date.now());
    });
  }, []);

  const dismissGuide = () => {
    try {
      localStorage.setItem(WALL_GUIDE_KEY, "1");
    } catch {
      /* 記不住，下次再見。 */
    }
    setGuideOpen(false);
  };

  if (posts === null) return null;
  const shown = tab === "hot" ? sortHot(posts, now) : sortLatest(posts);

  return (
    <div>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

      <div className="mt-3 flex gap-2" role="tablist" aria-label={t("title")}>
        {(["hot", "latest"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`font-hand inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-base font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
              tab === key
                ? "scale-105 bg-primary text-primary-foreground"
                : "bg-card"
            }`}
          >
            {key === "hot" ? (
              <Flame size={16} aria-hidden />
            ) : (
              <Sparkles size={16} aria-hidden />
            )}
            {t(key === "hot" ? "tabHot" : "tabLatest")}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed bg-card p-8 text-center">
          <p className="font-hand text-2xl font-bold">{t("emptyTitle")}</p>
          <p className="text-muted-foreground mt-2 text-sm">{t("emptyBody")}</p>
          <Link
            href="/?shoot=1"
            className="font-hand mt-4 inline-flex items-center gap-2 rounded-full border-2 bg-accent px-4 py-2 font-bold text-accent-foreground shadow-[2px_2px_0_var(--border)]"
          >
            {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((post, i) => {
            const spin = TILE_SPIN[i % TILE_SPIN.length] as number;
            const rank = tab === "hot" ? i : -1;
            return (
              <Link
                key={post.id}
                href={`/wall/${post.id}`}
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                className={`${styles.wallIn} block rounded-xl border-2 bg-[#fdfdf8] p-2 pb-2 shadow-[2px_2px_0_var(--border)] transition-transform duration-150 hover:scale-[1.03] active:scale-95`}
              >
                <span
                  className="relative block overflow-hidden rounded-lg"
                  style={{ rotate: `${spin}deg` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.photo}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  {rank >= 0 && rank < 3 && (
                    <span
                      aria-hidden
                      className="absolute top-1 left-1 flex h-7 w-7 -rotate-12 items-center justify-center rounded-full border-2 text-sm font-bold"
                      style={{
                        backgroundColor: RANK_COLORS[rank] as string,
                        borderColor: "var(--border)",
                      }}
                    >
                      {rank + 1}
                    </span>
                  )}
                  <span className="absolute right-1 bottom-1 flex items-center gap-1">
                    {post.audioSeconds !== null && (
                      <span
                        aria-hidden
                        className="flex h-6 w-6 items-center justify-center rounded-full border-2 bg-card"
                      >
                        <Mic size={12} aria-hidden />
                      </span>
                    )}
                    <span
                      aria-hidden
                      className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 bg-[#ffd9e2] px-1"
                      style={{ rotate: "8deg" }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5"
                        fill={post.likedByMe ? "#d6336c" : "none"}
                        stroke="#7b1e26"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20 Q4 15 4 9 Q4 5 8 5 Q10 5 12 8 Q14 5 16 5 Q20 5 20 9 Q20 15 12 20 Z" />
                      </svg>
                    </span>
                  </span>
                  {post.createdAt > seenAt && (
                    <span className="absolute top-1 right-1 rounded-full border-2 bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {t("newBadge")}
                    </span>
                  )}
                </span>
                <span className="mt-1.5 flex items-center justify-between px-0.5 text-xs">
                  <span className="max-w-[60%] truncate font-bold">
                    {post.author.me ? t("you") : post.author.nickname}
                  </span>
                  <span className="text-muted-foreground">
                    {t("likes", { n: post.likes })}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {guideOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-6">
          <div className="relative w-full max-w-xs rounded-2xl border-2 bg-card p-6 pt-8 shadow-[4px_4px_0_var(--border)]">
            <div
              aria-hidden
              className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-(--tape)"
            />
            <p className="font-hand text-2xl font-bold">{t("guideTitle")}</p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t("guideBody")}
            </p>
            <button
              onClick={dismissGuide}
              className="font-hand mt-4 w-full rounded-full border-2 bg-accent px-3 py-1.5 font-bold text-accent-foreground shadow-[2px_2px_0_var(--border)]"
            >
              {t("guideOk")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
