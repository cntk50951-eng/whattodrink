"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { RevealPhoto } from "@/components/drinks/gallery";

type V2RevealOverlayProps = {
  photo: RevealPhoto;
  /** 抽下一張（1 張池時同圖，屬預期——照片多了之後才有感）。 */
  onReshuffle: () => void;
  onClose: () => void;
};

/**
 * UR C.22 黑底揭曉 overlay——點霓虹 CTA 即此頁（取代 Sheet；舊 cats/batch 鏈保留給 pills 退路）。
 *
 * - 全屏 `bg-black/95` 蓋掉地圖＋TabBar（z 蓋過地圖系 `z-[1000]` chrome）。
 * - 關閉三路：背景點／右上 X／Esc；主鈕只換圖不關。
 * - GIF 用 `unoptimized`（優化管線會殺動畫）＋`object-contain`（9x16 豎幅保全圖）。
 * - 無進場動畫（GIF 本體已在動），reduced-motion 零處理即合規。
 */
export function V2RevealOverlay({
  photo,
  onReshuffle,
  onClose,
}: V2RevealOverlayProps) {
  const t2 = useTranslations("v2");

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t2("revealTitle")}
      className="fixed inset-0 z-[1100] flex flex-col bg-black/95"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between p-4">
        <p className="text-base font-bold text-white">{t2("revealTitle")}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t2("revealClose")}
          onClick={onClose}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <Image
          src={photo.src}
          alt={t2(photo.altKey)}
          fill
          sizes="100vw"
          priority
          unoptimized
          className="object-contain"
        />
      </div>
      <div className="flex justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" className="h-12 rounded-full px-8 text-base font-bold" onClick={onReshuffle}>
          <RefreshCw aria-hidden />
          {t2("revealAgain")}
        </Button>
      </div>
    </div>
  );
}
