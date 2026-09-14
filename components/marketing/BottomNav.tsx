"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Camera,
  Dices,
  Images,
  Sparkles,
} from "lucide-react";

import { hasUnseenWall, loadWall, loadWallSeenAt } from "@/lib/posts";

import styles from "./bottom-nav.module.css";

/**
 * URC 1.2 v4：4 鈕各自獨立（不包 box），跟啤酒同款圓鈕風格。
 *
 * 視覺：圓＋ink 邊＋硬陰影＋card 底＋accent 主色，無 label；
 * 大小 h-11 w-11（比啤酒 h-16 小一檔但仍是頁面顯眼元素）；
 * hover/active 沿 MapToolbar 配方（同衛星圓鈕家族）。
 *
 * 牆紅點沿用 UR4.1 v3（icon 右上角 dot）。
 */
export function BottomNav() {
  const t = useTranslations("nav");
  const [wallDot, setWallDot] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => {
      setWallDot(hasUnseenWall(loadWall(), loadWallSeenAt()));
    });
  }, []);
  const items = [
    { key: "random", href: "/?pick=1", label: t("randomPick"), Icon: Dices },
    { key: "photo", href: "/?shoot=1", label: t("photoPick"), Icon: Camera },
    { key: "wall", href: "/wall", label: t("wallPick"), Icon: Images },
    { key: "mood", href: "/mood", label: t("moodPick"), Icon: Sparkles },
  ] as const;

  return (
    <nav
      aria-label={t("menu")}
      // URC 1.2 v4：4 鈕獨立 flex 排，無 box 包裹。
      className={`${styles.bottomNav} flex items-end gap-1.5`}
    >
      {items.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-label={label}
          // 圓鈕家族：圓＋ink 邊＋硬陰影＋card 底；active 壓感同衛星鈕
          // 配方（MapToolbar .toolbarBtn）。accent 主色讓 4 鈕一眼可辨。
          className={`${styles.bnItem} relative flex h-11 w-11 items-center justify-center rounded-full border-2 bg-card text-primary shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
        >
          <Icon size={18} aria-hidden strokeWidth={2.5} />
          {key === "wall" && wallDot && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-(--border) bg-(--doodle-red)"
            />
          )}
        </Link>
      ))}
    </nav>
  );
}