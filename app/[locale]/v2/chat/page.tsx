"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import styles from "@/components/v2/v2.module.css";

/**
 * UR C.15 聊天列表（stub：列表待實現，先佔位）。
 * 只給空態＋回地圖 CTA，不造假會話數據；`back` 沿 C.5 既有 key。
 */
export default function V2ChatListPage() {
  const t = useTranslations("v2");
  const locale = useLocale();
  const homeHref = locale === "zh-Hant" ? "/v2" : `/${locale}/v2`;

  return (
    <div className={`${styles.v2scope} flex h-dvh flex-col bg-background p-4`}>
      <header className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={t("back")} render={<Link href={homeHref} />} nativeButton={false}>
          <ChevronLeft size={18} aria-hidden className="size-[18px]" />
        </Button>
        <h1 className="text-base font-semibold">{t("chatListTitle")}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <MessageCircle size={40} aria-hidden className="size-10 text-muted-foreground" />
        <p className="max-w-60 text-sm text-muted-foreground">{t("chatListEmpty")}</p>
        <Button variant="outline" render={<Link href={homeHref} />} nativeButton={false}>
          {t("back")}
        </Button>
      </div>
    </div>
  );
}
