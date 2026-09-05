"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { Camera, Dices, Expand, LocateFixed, Minus, Plus } from "lucide-react";

import styles from "./drink-map.module.css";

type MapFabProps = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  /**
   * A bottom card is open — the dial hides entirely instead of floating
   * mid-map (UR1.4: the beer lives in the corner, nowhere else).
   * Closing the card brings it back.
   */
  hidden: boolean;
  /** True while a 想喝 pin sits on the map — red dot on the main button. */
  hasWant: boolean;
  onPick: () => void;
  onPhoto: () => void;
  onRecenter: () => void;
  onFitHk: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

/** 上一次点开啤酒按钮的时间戳（ms）。12 小时内不再做任何闲置提示。 */
const TAP_KEY = "wtd-fab-tap";
const QUIET_MS = 12 * 3600 * 1000;

/**
 * localStorage 必须走 useSyncExternalStore：lazy useState initializer 在
 * 服务端读不到（回默认值）、客户端读到真值 → 首屏不一致 → hydration 崩。
 * server 快照恒为 false（服务端和客户端首屏一致），客户端挂载后按真值纠正。
 */
function subscribeFabTap(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readFabQuiet(): boolean {
  try {
    const raw = window.localStorage.getItem(TAP_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 && Date.now() - n < QUIET_MS;
  } catch {
    // 隐私模式等 —— 读不到就当从未点过，提示常开，无害。
    return false;
  }
}

function serverFabQuiet(): boolean {
  return false;
}
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
  hidden,
  hasWant,
  onPick,
  onPhoto,
  onRecenter,
  onFitHk,
  onZoomIn,
  onZoomOut,
}: MapFabProps) {
  const t = useTranslations("map");
  // 静默期走外部 store（ hydration 安全，见上面注释）。
  const quiet = useSyncExternalStore(
    subscribeFabTap,
    readFabQuiet,
    serverFabQuiet,
  );
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
    try {
      window.localStorage.setItem(TAP_KEY, String(Date.now()));
    } catch {
      // 隐私模式等 —— 下次再提示，无害。
    }
    // 同 tab 无 storage 事件，靠这次重渲染（setIdleLevel＋父级 onToggle）
    // 让外部 store 读到新快照。
    setIdleLevel(0);
    onToggle();
  }

  // Fan rows stack upward from the beer via absolute offsets (row 44px +
  // 10px gap; pick nearest the thumb). They are OUT of flow so the closed
  // fan occupies zero space and the beer truly sits in the corner.
  // keepOpen：地图相机类操作不收扇形，可连点。
  // hot：主入口 accent 高亮，和工具按钮拉开层级。
  const actions: {
    key: string;
    label: string;
    icon: typeof Plus;
    run: () => void;
    keepOpen: boolean;
    hot?: boolean;
  }[] = [
    { key: "zin", label: t("zoomIn"), icon: Plus, run: onZoomIn, keepOpen: true },
    { key: "zout", label: t("zoomOut"), icon: Minus, run: onZoomOut, keepOpen: true },
    { key: "hk", label: t("hkWide"), icon: Expand, run: onFitHk, keepOpen: true },
    { key: "recenter", label: t("recenter"), icon: LocateFixed, run: onRecenter, keepOpen: true },
    { key: "photo", label: t("photo"), icon: Camera, run: onPhoto, keepOpen: false, hot: true },
    { key: "pick", label: t("pickCta"), icon: Dices, run: onPick, keepOpen: false },
  ];

  // 卡片展开时整个 dial 藏起来 —— 啤酒只住左下角，不浮半空。
  if (hidden) return null;

  return (
    <div
      className={`${styles.above} ${styles.fabDock} absolute left-3`}
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          // UR1.5：整行单个 button——图标＋文字同一点击区、单个 tab stop。
          // button 不可嵌套 button，所以圆形图标退为纯视觉 span；
          // 按压缩放反馈走 group-active 平移过去（点文字时圆形照样压一下）。
          <button
            key={action.key}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={action.label}
            onClick={() => {
              action.run();
              if (!action.keepOpen) onClose();
            }}
            style={
              {
                "--fan-rise": `${74 + (actions.length - 1 - i) * 54}px`,
                "--fan-delay": `${(actions.length - 1 - i) * 50}ms`,
              } as CSSProperties
            }
            className={`${styles.fanItem} group flex cursor-pointer items-center gap-2 text-left transition-all motion-safe:duration-200 ${
              open
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-3 scale-50 opacity-0"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-[2px_2px_0_var(--border)] transition-transform group-active:translate-x-0.5 group-active:translate-y-0.5 group-active:shadow-none ${
                action.hot ? "bg-accent text-accent-foreground" : "bg-card"
              }`}
            >
              <Icon size={19} aria-hidden />
            </span>
            <span className="rounded-full border-2 bg-card px-2.5 py-1 text-xs font-bold whitespace-nowrap shadow-[2px_2px_0_var(--border)]">
              {action.label}
            </span>
          </button>
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
