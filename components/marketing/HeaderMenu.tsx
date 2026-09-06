"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Camera,
  ChevronRight,
  Dices,
  Menu as MenuIcon,
  Sparkles,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./header-menu.module.css";

/**
 * UR1.7 header menu, UR2.2 redesigned (design-taste skill round — see memory).
 * Same Base UI architecture, same 3 links, new character: icon tiles +
 * large type + forward chevrons, rows cascading in with a springy stagger,
 * trigger morphing Menu<->X. Doodle lock untouched (border-2, hard shadow,
 * font-hand); no new copy, no backdrop (dropdown idiom needs no scrim),
 * z-[1100] portal rule intact (see 2026-09-06-dropdown-portal memory).
 */
export function HeaderMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const items = [
    { key: "random", href: "/?pick=1", label: t("randomPick"), Icon: Dices },
    { key: "photo", href: "/camera", label: t("photoPick"), Icon: Camera },
    { key: "mood", href: "/mood", label: t("moodPick"), Icon: Sparkles },
  ] as const;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={t("menu")}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card shadow-[2px_2px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <span className="relative block h-5 w-5" aria-hidden>
          <MenuIcon
            size={20}
            className={`absolute inset-0 transition-all motion-safe:duration-200 ${
              open ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
            }`}
          />
          <X
            size={20}
            className={`absolute inset-0 transition-all motion-safe:duration-200 ${
              open ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
            }`}
          />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-60 rounded-2xl border-2 bg-card p-2 shadow-[3px_3px_0_var(--border)]"
      >
        {items.map(({ key, href, label, Icon }, i) => (
          <DropdownMenuItem
            key={key}
            render={<Link href={href} />}
            className={`${styles.menuItem} font-hand min-h-14 cursor-pointer gap-3 rounded-xl px-3 py-2 text-lg font-bold`}
            style={{ "--mi": `${i * 60}ms` } as CSSProperties}
          >
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 bg-secondary text-secondary-foreground"
            >
              {/* size-* class dodges the shadcn svg-size override. */}
              <Icon size={19} aria-hidden className="size-[19px]" />
            </span>
            {label}
            <ChevronRight size={16} aria-hidden className="ml-auto opacity-60" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
