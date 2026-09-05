"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Camera, Dices, Menu as MenuIcon, Sparkles } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * UR1.7 header menu — the replacement entry for the three retired Bento
 * cards (random pick / photo pick / mood). Compact Base UI dropdown, not a
 * full page: 3 links don't earn a route, and a page would bury the map
 * (design-taste skill round — see memory). Re-skinned to the doodle lock
 * (border-2, hard shadow, font-hand, 44px targets) instead of shadcn
 * defaults; every item navigates, so no open-state management is needed.
 */
export function HeaderMenu() {
  const t = useTranslations("nav");
  const items = [
    { key: "random", href: "/?pick=1", label: t("randomPick"), Icon: Dices },
    { key: "photo", href: "/camera", label: t("photoPick"), Icon: Camera },
    { key: "mood", href: "/mood", label: t("moodPick"), Icon: Sparkles },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menu")}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <MenuIcon size={20} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48 rounded-2xl border-2 bg-card p-2 shadow-[3px_3px_0_var(--border)]"
      >
        {items.map(({ key, href, label, Icon }) => (
          <DropdownMenuItem
            key={key}
            render={<Link href={href} />}
            className="font-hand min-h-11 cursor-pointer gap-2.5 rounded-xl px-3 py-2 text-base font-bold"
          >
            <Icon size={19} aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
