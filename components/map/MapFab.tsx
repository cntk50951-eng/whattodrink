"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dices, Expand, LocateFixed, Minus, Plus } from "lucide-react";

import styles from "./drink-map.module.css";

type MapFabProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** A bottom card is open — ride above it instead of under it. */
  lifted: boolean;
  /** True while a 想喝 pin sits on the map — red dot on the main button. */
  hasWant: boolean;
  onPick: () => void;
  onRecenter: () => void;
  onFitHk: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

/** 上一次点开啤酒按钮的时间戳（ms）。12 小时内不再做任何闲置提示。 */
const TAP_KEY = "wtd-fab-tap";
const QUIET_MS = 12 * 3600 * 1000;
/** 3 秒无操作 → 摇晃一下；20 秒无操作 → 冒泡提示。 */
const SHAKE_AFTER_MS = 3000;
const BUBBLE_AFTER_MS = 20000;

/**
 * UR1.3 地图 speed-dial —— 所有地图操作的唯一入口，停靠在左下。
 *
 * 主按钮是一杯手绘啤酒：溢出的酒花泡沫、杯内气泡无限上升。
 * 三层可点性提示（只在“从未点开过、或上次点开已超过 12 小时”时启用）：
 * 1）红色呼吸光环常驻；2）3 秒无任何点击，杯子摇晃一次；
 * 3）20 秒无任何点击，弹出漫画气泡。任意 pointerdown 都重置计时。
 * 相机类操作（缩放／回位／全港）点后扇形保持展开，可连续操作；
 * 只有选酒会收起（要给底部抽屉让位）。
 */
export function MapFab({
  open,
  onToggle,
  onClose,
  lifted,
  hasWant,
  onPick,
  onRecenter,
  onFitHk,
  onZoomIn,
  onZoomOut,
}: MapFabProps) {
  const t = useTranslations("map");
  // 懒读：点开过且在 12 小时内 = 静默期。SSR 没有 window
  // （ReferenceError 落进 catch 回 false = 需要提示）。
  const [quiet, setQuiet] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(TAP_KEY);
      const n = raw === null ? 0 : Number(raw);
      return Number.isFinite(n) && n > 0 && Date.now() - n < QUIET_MS;
    } catch {
      // 隐私模式等 —— 读不到就当从未点过，提示常开，无害。
      return false;
    }
  });
  const suppressed = quiet;
  // 0 = 刚操作过／活跃中，1 = 3 秒闲置（摇过），2 = 20 秒闲置（冒泡）。
  const [idleLevel, setIdleLevel] = useState(0);

  // 闲置计时：任意点击都重置。点开过 12 小时内直接不布防。
  useEffect(() => {
    if (suppressed) return;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const arm = (reset: boolean): void => {
      if (reset) setIdleLevel(0);
      clearTimeout(t1);
      clearTimeout(t2);
      t1 = setTimeout(() => setIdleLevel(1), SHAKE_AFTER_MS);
      t2 = setTimeout(() => setIdleLevel(2), BUBBLE_AFTER_MS);
    };
    arm(false);
    const onDown = (): void => arm(true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [suppressed]);

  function handleToggle(): void {
    const now = Date.now();
    setQuiet(true);
    setIdleLevel(0);
    try {
      window.localStorage.setItem(TAP_KEY, String(now));
    } catch {
      // 隐私模式等 —— 下次再提示，无害。
    }
    onToggle();
  }

  // 从上往下排（column-reverse）：最不常用的在上，选酒贴着拇指在最下。
  // keepOpen：相机类操作不收扇形，可连点（尤其是缩放 +/-）。
  const actions = [
    { key: "zin", label: t("zoomIn"), icon: Plus, run: onZoomIn, keepOpen: true },
    { key: "zout", label: t("zoomOut"), icon: Minus, run: onZoomOut, keepOpen: true },
    { key: "hk", label: t("hkWide"), icon: Expand, run: onFitHk, keepOpen: true },
    { key: "recenter", label: t("recenter"), icon: LocateFixed, run: onRecenter, keepOpen: true },
    { key: "pick", label: t("pickCta"), icon: Dices, run: onPick, keepOpen: false },
  ];

  return (
    <div
      className={`${styles.above} absolute left-4 flex flex-col-reverse items-start gap-2.5 transition-[bottom] motion-safe:duration-200 ${
        lifted ? "bottom-[calc(50%+0.75rem)]" : "bottom-24 md:bottom-24"
      }`}
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <div
            key={action.key}
            className={`flex items-center gap-2 transition-all motion-safe:duration-200 ${
              open
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-3 scale-50 opacity-0"
            } delay-[${(actions.length - 1 - i) * 50}ms]`}
          >
            <button
              type="button"
              tabIndex={open ? 0 : -1}
              aria-label={action.label}
              onClick={() => {
                action.run();
                if (!action.keepOpen) onClose();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Icon size={19} aria-hidden />
            </button>
            <span className="rounded-full border-2 bg-card px-2.5 py-1 text-xs font-bold whitespace-nowrap shadow-[2px_2px_0_var(--border)]">
              {action.label}
            </span>
          </div>
        );
      })}
      <div className="relative flex items-center gap-2">
        {!suppressed && !open && idleLevel >= 2 && (
          <span
            role="status"
            className={`${styles.fabBubblePop} font-hand absolute bottom-[4.5rem] left-0 w-max max-w-44 rounded-2xl border-2 bg-card px-3 py-2 text-sm font-bold whitespace-normal shadow-[3px_3px_0_var(--border)]`}
          >
            {t("fabBubble")}
          </span>
        )}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-label={t("fabMenu")}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-primary text-primary-foreground shadow-[4px_4px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
            !suppressed && !open && idleLevel >= 1 ? styles.fabShake : ""
          }`}
        >
          {!suppressed && <span aria-hidden className={styles.fabPing} />}
          {hasWant && (
            <span
              aria-hidden
              className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full border-2 bg-(--doodle-red)"
            />
          )}
          <svg
            viewBox="0 0 36 36"
            width="38"
            height="38"
            aria-hidden
            className="overflow-visible"
          >
            <g
              fill="none"
              stroke="var(--border)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 把手 */}
              <path d="M 25 18 L 28 18 A 4 4 0 0 1 28 27 L 25 27" />
              {/* 杯身 */}
              <rect x="9" y="13" width="16" height="17" rx="3" fill="var(--card)" />
              {/* 酒液 */}
              <rect x="11" y="19.5" width="12" height="8.5" fill="var(--primary)" stroke="none" />
              {/* 酒液高光 */}
              <rect x="12.5" y="21" width="2.5" height="6" rx="1.2" fill="var(--card)" stroke="none" opacity="0.55" />
              {/* 溢出的酒花泡沫 */}
              <path
                d="M 8 14.5 Q 7.5 9.5 12 9.5 Q 13.5 6 17 7 Q 20 4 22.5 7 Q 27 6.5 27.5 11 Q 28.5 14.5 25 15.5 L 11 15.5 Q 8.5 15.5 8 14.5 Z"
                fill="var(--card)"
              />
              {/* 泡沫质感点 */}
              <circle cx="14" cy="10.5" r="1.1" strokeWidth="1.4" fill="var(--card)" />
              <circle cx="20.5" cy="9" r="1.3" strokeWidth="1.4" fill="var(--card)" />
              {/* 顺着杯壁淌下的两道泡沫 */}
              <path d="M 14.5 15.5 L 14.5 19.5 A 1.5 1.5 0 0 1 11.5 19.5 L 11.5 15.5" fill="var(--card)" strokeWidth="1.6" />
              <path d="M 23.5 15.5 L 23.5 18.5 A 1.5 1.5 0 0 1 20.5 18.5 L 20.5 15.5" fill="var(--card)" strokeWidth="1.6" />
            </g>
            {/* 杯内上升气泡 */}
            <circle cx="15" cy="23.5" r="1.4" fill="var(--card)" className={`${styles.beerBubble} ${styles.b1}`} />
            <circle cx="19" cy="25" r="1.1" fill="var(--card)" className={`${styles.beerBubble} ${styles.b2}`} />
            <circle cx="16.8" cy="26.5" r="0.9" fill="var(--card)" className={`${styles.beerBubble} ${styles.b3}`} />
          </svg>
        </button>
        {!suppressed && !open && idleLevel < 2 && (
          <span
            className={`${styles.fabHint} font-hand rounded-full border-2 bg-card px-3 py-1.5 text-sm font-bold whitespace-nowrap shadow-[2px_2px_0_var(--border)]`}
          >
            {t("fabHint")}
          </span>
        )}
      </div>
    </div>
  );
}
