"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, LogIn, LogOut } from "lucide-react";

import { displayName } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * UR A.7 選單登入項：掛載讀一次 session＋訂閱變化。
 * 未登入→登入入口（`/login`）；已登入→暱稱＋登出動作。
 * 樣式沿 HeaderMenu 的 menuItem（className 由父傳入保一致）。
 */
export function AuthMenuItem({ className }: { className: string }) {
  const t = useTranslations("auth");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const user = data.user;
      setName(
        user === null
          ? null
          : displayName(
              (user.user_metadata ?? {}) as Record<string, unknown>,
              user.email ?? null,
            ),
      );
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const user = session?.user ?? null;
      setName(
        user === null
          ? null
          : displayName(
              (user.user_metadata ?? {}) as Record<string, unknown>,
              user.email ?? null,
            ),
      );
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    setName(null);
    router.refresh();
  }

  if (!ready) return null;
  const tile = (Icon: typeof LogIn) => (
    <span
      aria-hidden
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border-2 bg-secondary text-secondary-foreground"
    >
      <Icon size={19} aria-hidden className="size-[19px]" />
    </span>
  );
  if (name === null) {
    return (
      <DropdownMenuItem render={<Link href="/login" />} className={className}>
        {tile(LogIn)}
        {tn("signIn")}
        <ChevronRight size={16} aria-hidden className="ml-auto opacity-60" />
      </DropdownMenuItem>
    );
  }
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => void handleLogout()}
        className={className}
      >
        {tile(LogOut)}
        {t("logoutName", { name })}
        <ChevronRight size={16} aria-hidden className="ml-auto opacity-60" />
      </DropdownMenuItem>
    </>
  );
}
