"use client";

import { useTranslations } from "next-intl";
import { Beer, ChevronRight, Flag, Martini, UserPlus } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ActivityCounts } from "@/hooks/useActivityCounts";
import styles from "./v2.module.css";

/**
 * UR G.7 動態中心（v2-only；對標 iOS 動態頁的收斂入口）。
 * 四行只做分流（計數＋直達）：碰杯走現有 CheersMailbox、邀約走聊天頁、
 * 通知／好友請求走本輪新 Sheet；計數來自 useActivityCounts（/me/counters）。
 */
export function V2ActivitySheet({
  open,
  onClose,
  counts,
  onOpenCheers,
  onOpenInvites,
  onOpenNotices,
  onOpenRequests,
}: {
  open: boolean;
  onClose: () => void;
  counts: ActivityCounts;
  onOpenCheers: () => void;
  onOpenInvites: () => void;
  onOpenNotices: () => void;
  onOpenRequests: () => void;
}) {
  const t = useTranslations("v2");
  const rows = [
    { icon: Beer, label: t("actCheers"), n: counts.cheers, go: onOpenCheers },
    { icon: Martini, label: t("actInvites"), n: counts.invites, go: onOpenInvites },
    { icon: Flag, label: t("actNotices"), n: counts.notices, go: onOpenNotices },
    { icon: UserPlus, label: t("actRequests"), n: counts.requests, go: onOpenRequests },
  ];
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[70svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>{t("actTitle")}</SheetTitle>
          <SheetDescription className="sr-only">{t("actTitle")}</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.label}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  r.go();
                }}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
              >
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <r.icon size={18} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold">{r.label}</span>
                {r.n > 0 && (
                  <span className="shrink-0 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                    {r.n > 99 ? "99+" : r.n}
                  </span>
                )}
                <ChevronRight size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
