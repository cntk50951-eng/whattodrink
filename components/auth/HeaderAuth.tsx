"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { clearUserLocalCaches } from "@/lib/auth/clear";
import { displayName } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * UR A.7 header 已登入態：顯示暱稱頭像 + 登出。
 * 掛載後讀 session 並訂閱變化，未登入時顯示登入鈕，避免 header 空白。
 */
export function HeaderAuth() {
  const t = useTranslations("nav");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const user = data.user;
      if (user === null) {
        setName(null);
        setAvatar(null);
      } else {
        setName(
          displayName(
            (user.user_metadata ?? {}) as Record<string, unknown>,
            user.email ?? null,
          ),
        );
        const av = (user.user_metadata as Record<string, unknown> | null)?.avatar_url;
        setAvatar(typeof av === "string" ? av : null);
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const user = session?.user ?? null;
      if (user === null) {
        setName(null);
        setAvatar(null);
      } else {
        setName(
          displayName(
            (user.user_metadata ?? {}) as Record<string, unknown>,
            user.email ?? null,
          ),
        );
        const av = (user.user_metadata as Record<string, unknown> | null)?.avatar_url;
        setAvatar(typeof av === "string" ? av : null);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUserLocalCaches();
    setName(null);
    setAvatar(null);
    router.refresh();
  }

  if (!ready) {
    return (
      <Button size="sm" nativeButton={false} render={<Link href="/login" />} disabled>
        {t("signIn")}
      </Button>
    );
  }

  if (name === null) {
    return (
      <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
        {t("signIn")}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {avatar !== null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={name}
          className="h-8 w-8 rounded-full border-2 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-secondary text-sm font-bold">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="hidden max-w-24 truncate text-sm font-bold sm:inline">{name}</span>
      <Button size="sm" variant="outline" onClick={() => void handleLogout()}>
        {ta("logout")}
      </Button>
    </div>
  );
}
