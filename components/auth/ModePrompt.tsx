"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { UserMode } from "@/lib/mode";

/** UR A.16 隱身守衛動作（引導文案按動作區分）。 */
export type GuardAction = "checkin" | "cheers" | "invite" | "like" | "photo";

type ModePromptProps = {
  open: boolean;
  action: GuardAction;
  /** 切換模式（父層接 hook 的 patchMode）；回 true 即關層。 */
  onSwitch: (mode: UserMode) => Promise<boolean>;
  /** 切換成功後（關層前）回調：父層用來恢復被守衛收起的卡。 */
  onSwitched?: (mode: UserMode) => void;
  onClose: () => void;
};

const ACTION_KEYS: Record<GuardAction, string> = {
  checkin: "actCheckin",
  cheers: "actCheers",
  invite: "actInvite",
  like: "actLike",
  photo: "actPhoto",
};

/**
 * UR A.16 隱身攔截浮層（沿 stealthPrompt doodle 卡＋硬陰影＋膠帶配方，
 * 多兩個一鍵切換鈕：切換為公開／好友直調 `PATCH /me`，免跳頁）。
 */
export function ModePrompt({ open, action, onSwitch, onSwitched, onClose }: ModePromptProps) {
  const t = useTranslations("mode");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!open) return null;

  const doSwitch = (next: UserMode): void => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    void onSwitch(next).then((ok) => {
      setBusy(false);
      if (ok) {
        onSwitched?.(next);
        onClose();
      } else setFailed(true);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("guardTitle")}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        role="document"
        className="relative w-full max-w-sm rounded-2xl border-2 bg-card p-6 pt-7 shadow-[4px_4px_0_var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 bg-(--tape)" />
        <p className="font-hand text-center text-xl font-bold">{t("guardTitle")}</p>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
          {t("guardBody", { action: t(ACTION_KEYS[action]) })}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void doSwitch("public")}
            disabled={busy}
            className="font-hand rounded-full border-2 bg-primary px-4 py-2.5 text-base font-bold text-primary-foreground shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
          >
            {busy ? t("switching") : t("switchPublic")}
          </button>
          <button
            type="button"
            onClick={() => void doSwitch("friends")}
            disabled={busy}
            className="font-hand rounded-full border-2 bg-card px-4 py-2.5 text-base font-bold shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
          >
            {busy ? t("switching") : t("switchFriends")}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-hand mt-2 w-full rounded-full px-4 py-1.5 text-sm font-bold text-muted-foreground"
        >
          {t("cancel")}
        </button>
        {failed && (
          <p role="alert" className="mt-2 text-center text-xs font-bold text-red-600">
            {t("switchFailed")}
          </p>
        )}
      </div>
    </div>
  );
}
