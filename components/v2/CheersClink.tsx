"use client";

import { Beer } from "lucide-react";

import styles from "./v2.module.css";

/** UR E.14 碰杯时刻（v2-only；v1 DrinkMap 移植＋重皮，2.2s 与 CHEERS_FX_MS 对齐）。 */
export const CHEERS_FX_MS = 2200;

function MugChip() {
  return (
    <span
      aria-hidden
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/40"
    >
      <Beer size={40} />
    </span>
  );
}

/**
 * 卡内绝对覆盖层（调用方给相对定位祖先；播完调用方拆，沿 v1 口径）。
 * reduced-motion 由调用方不渲染，直接收据。
 */
export function CheersClink({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      className={`${styles.v2cheersFx} pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card/70`}
    >
      <span className={`${styles.v2cheersMugL} shrink-0`}>
        <MugChip />
      </span>
      <svg viewBox="0 0 100 100" className={`${styles.v2cheersStar} absolute w-28`}>
        <polygon
          points="50,4 60,33 93,30 68,52 80,86 50,66 22,88 31,53 6,33 40,36"
          fill="#fbbf24"
          stroke="var(--foreground)"
          strokeOpacity="0.3"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        viewBox="0 0 120 60"
        className={`${styles.v2cheersLines} absolute w-44 text-muted-foreground`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M 4 10 L 34 22" />
        <path d="M 2 30 L 36 30" />
        <path d="M 4 50 L 34 38" />
        <path d="M 116 10 L 86 22" />
        <path d="M 118 30 L 84 30" />
        <path d="M 116 50 L 86 38" />
      </svg>
      <span className={`${styles.v2cheersBurst} absolute`} />
      <span className={`${styles.v2cheersFoam} ${styles.v2cheersF1} absolute h-2.5 w-2.5 rounded-full`} />
      <span className={`${styles.v2cheersFoam} ${styles.v2cheersF2} absolute h-2 w-2 rounded-full`} />
      <span className={`${styles.v2cheersFoam} ${styles.v2cheersF3} absolute h-3 w-3 rounded-full`} />
      <span className={`${styles.v2cheersFoam} ${styles.v2cheersF4} absolute h-2 w-2 rounded-full`} />
      <span className={`${styles.v2cheersFoam} ${styles.v2cheersF5} absolute h-2.5 w-2.5 rounded-full`} />
      <span className={`${styles.v2cheersMugR} shrink-0`}>
        <MugChip />
      </span>
      <span className={`${styles.v2cheersLabel} absolute text-5xl font-black`}>{label}</span>
    </div>
  );
}
