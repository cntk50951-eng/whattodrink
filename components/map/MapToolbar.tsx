"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  Expand,
  Footprints,
  LocateFixed,
  Vibrate,
} from "lucide-react";

import styles from "./drink-map.module.css";

type MapToolbarProps = {
  /** 舊 prop：sheet／card／指引任一打開時整組讓位。保留語義。 */
  hidden: boolean;
  /** URC 1.3：預設收合（true = 不渲染）；展開由父層切換 */
  collapsed: boolean;
  /** UR2.5 摇摇：点击＝程序化摇动（权限申请由调用方包办）。 */
  onShake: () => void;
  /** UR2.9 触发计数（调用方每次触发＋1，含 prime tick）：按钮 key 重挂
   * 重播 rattle，和 idle wobble 三元互斥（同一元素单动画）。 */
  shakeBurst: number;
  onRecenter: () => void;
  onFitHk: () => void;
  /** UR3.4 足迹：进足迹模式（调用方再点一次退出，toggle 语义）。 */
  onFootprints: () => void;
};

/** 摇摇用过就 12 小时不抖——和 MapFab 旧版同一套（hydration 安全）。 */
const SHAKE_USED_KEY = "wtd-shake-used";
const QUIET_MS = 12 * 3600 * 1000;
/** 摇摇按钮的抖动周期：5 分钟一次（用户原话"每隔几分钟"）。 */
const SHAKE_WOBBLE_EVERY_MS = 5 * 60 * 1000;

function subscribeShakeUsed(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readShakeQuiet(): boolean {
  try {
    const raw = window.localStorage.getItem(SHAKE_USED_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 && Date.now() - n < QUIET_MS;
  } catch {
    return false;
  }
}

function serverShakeQuiet(): boolean {
  return false;
}

/** 触发一次有效摇动（按钮或真机）就调 —— 同 tab 靠父级重渲染带出新快照。
 * URC 1.0：原在 MapFab，搖一搖搬進 MapToolbar 後搬過來。 */
export function markShakeUsed(): void {
  try {
    window.localStorage.setItem(SHAKE_USED_KEY, String(Date.now()));
  } catch {
    // 隐私模式 —— 下次再停抖，无害。
  }
}

/**
 * URC 1.0 / URC 1.1 地圖工具列。
 *
 * URC 1.0：地圖操作收進地圖組件，跟城市卡同列堆疊。
 * URC 1.1：砍掉 +/- 縮放按鈕（6 鈕變 4 鈕），改用：
 *   - 行動裝置雙指捏合（CSS `touch-action: pan-y pinch-zoom` + Leaflet 默認）
 *   - 桌面 hover 地圖才啟用滾輪縮放（URC 1.1 A3，沿 UR1.3 scroll-trap 行為）
 *   - 鍵盤 +/- 鍵（Leaflet 內建 keyboard: true）
 *
 * 隱藏時機：底卡／sheet／定位指引任一打開，整組讓位。
 */
export function MapToolbar({
  hidden,
  collapsed,
  onShake,
  shakeBurst,
  onRecenter,
  onFitHk,
  onFootprints,
}: MapToolbarProps) {
  const t = useTranslations("map");
  // UR2.5 摇摇用过就 12h 内不抖（hydration 安全写法）。
  const shakeQuiet = useSyncExternalStore(
    subscribeShakeUsed,
    readShakeQuiet,
    serverShakeQuiet,
  );
  const [shakeWobble, setShakeWobble] = useState(false);
  useEffect(() => {
    if (shakeQuiet) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setShakeWobble(true);
      window.setTimeout(() => setShakeWobble(false), 650);
    }, SHAKE_WOBBLE_EVERY_MS);
    return () => window.clearInterval(id);
  }, [shakeQuiet]);

  if (hidden) return null;
  // URC 1.3 A1：預設收合不渲染；展開時走 transform/opacity 進場
  // （accordion 風格，map-toolbar-accordion keyframes）。
  if (collapsed) return null;

  // URC 1.1：砍 +/- 縮放鈕，4 鈕為睇全港／回位／足跡＋搖一搖衛星。
  // 縮放走雙指捏合／hover 滾輪／鍵盤 +/- 鍵（見頂部 JSDoc）。
  const mapOps = [
    { key: "hk", label: t("hkWide"), icon: Expand, run: onFitHk },
    { key: "recenter", label: t("recenter"), icon: LocateFixed, run: onRecenter },
    { key: "trail", label: t("footprints"), icon: Footprints, run: onFootprints },
  ] as const;

  return (
    <div
      role="toolbar"
      aria-label={t("fabMenu")}
      // URC 1.3 A1：展開用 transform/opacity accordion 進場。
      // URC 1.1：4 鈕＋搖一搖衛星。手機 flex-wrap（4 鈕＋衛星窄時仍
      // 可換行防熱榜），桌面單行。
      className={`${styles.above} ${styles.mapToolbar} flex flex-wrap items-center justify-center gap-1 md:flex-nowrap md:gap-1.5`}
    >
      {mapOps.map(({ key, label, icon: Icon, run }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          onClick={run}
          className={`${styles.toolbarBtn} flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none md:h-11 md:w-11`}
        >
          <Icon size={16} aria-hidden strokeWidth={2.5} className="md:hidden" />
          <Icon size={18} aria-hidden strokeWidth={2.5} className="hidden md:block" />
        </button>
      ))}
      {/* UR2.5 搖搖衛星鈕：同一圓鈕家族，反轉極性（card 底＋品牌色圖標）。
       * idle hint：12h 內用過就靜默；否則每 5 分鐘抖一次；burst 觸發重播 rattle。 */}
      <button
        key={shakeBurst}
        type="button"
        aria-label={t("shakeHint")}
        onClick={onShake}
        className={`${styles.toolbarBtnShake} flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-card text-primary shadow-[3px_3px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none md:h-11 md:w-11 ${
          shakeBurst > 0
            ? styles.fabRattle
            : shakeWobble
              ? styles.fabShake
              : ""
        }`}
      >
        <Vibrate size={17} aria-hidden strokeWidth={2.5} className="md:hidden" />
        <Vibrate size={20} aria-hidden strokeWidth={2.5} className="hidden md:block" />
      </button>
    </div>
  );
}