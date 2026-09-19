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

type BottomNavProps = {
  /** URC 1.2 A3 fix：Tonight's pick 直接觸發動作（不走 URL 變化）。
   * 用 button onClick 而非 Link，避免同 href 時 Next.js Link no-op
   * 導致重複點擊沒反應（用戶回報 bug）。 */
  onRandomPick: () => void;
  /** URC 1.2 A4：sheet／card／指引任一打開時整組讓位，
   * 不讓 sheet 跟按鈕在同一 y 打架。 */
  hidden?: boolean;
};

/**
 * URC 1.2 v4：4 鈕各自獨立（不包 box），跟啤酒同款圓鈕風格。
 *
 * 視覺：圓＋ink 邊＋硬陰影＋card 底＋accent 主色，無 label；
 * 大小 h-11 w-11（比啤酒 h-16 小一檔但仍是頁面顯眼元素）；
 * hover/active 沿 MapToolbar 配方（同衛星圓鈕家族）。
 *
 * 牆紅點沿用 UR4.1 v3（icon 右上角 dot）。
 */
export function BottomNav({ onRandomPick, hidden }: BottomNavProps) {
  const t = useTranslations("nav");
  const [wallDot, setWallDot] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => {
      setWallDot(hasUnseenWall(loadWall(), loadWallSeenAt()));
    });
  }, []);
  const items = [
    { key: "random", label: t("randomPick"), Icon: Dices, onClick: onRandomPick, href: null },
    { key: "photo", href: "/?shoot=1", label: t("photoPick"), Icon: Camera, onClick: null },
    { key: "wall", href: "/wall", label: t("wallPick"), Icon: Images, onClick: null },
    { key: "mood", href: "/mood", label: t("moodPick"), Icon: Sparkles, onClick: null },
  ] as const;

  if (hidden) return null;

  return (
    <nav
      aria-label={t("menu")}
      // URC 1.2 v4：4 鈕獨立 flex 排，無 box 包裹。
      className={`${styles.bottomNav} flex items-end gap-1.5`}
    >
      {items.map(({ key, href, label, Icon, onClick }) => {
        // URC 1.2 A3 fix：Tonight's pick 走 onClick 而非 Link，避免
        // 同 URL no-op bug（其餘 3 鈕跨頁仍走 Link）。
        if (onClick !== null) {
          return (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-label={label}
              className={`${styles.bnItem} relative flex h-11 w-11 items-center justify-center rounded-full border-2 bg-card text-primary shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
            >
              <Icon size={18} aria-hidden strokeWidth={2.5} />
            </button>
          );
        }
        return (
          <Link
            key={key}
            href={href as string}
            aria-label={label}
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
        );
      })}
    </nav>
  );
}