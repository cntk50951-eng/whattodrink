"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";

/** UR A.7 Google 一鍵登入鈕（全站唯一登入方式，無密碼框）。 */
export function LoginPanel({ failed }: { failed: boolean }) {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed);

  async function handleGoogle(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error !== null) {
        console.error("[auth] signInWithOAuth error:", error);
        setError(true);
      }
    } catch (err) {
      // silent catch 之前害 debug 兩輪——現在 log 進 console，prod 也看得到
      console.error("[auth] handleGoogle threw:", err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy}
        className="font-hand inline-flex w-full max-w-xs items-center justify-center gap-2.5 rounded-2xl border-2 bg-card px-4 py-3 text-lg font-bold shadow-[3px_3px_0_var(--border)] transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.2 0-5.9-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z"
            />
            <path
              fill="#EA4335"
              d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.8c.9-2.9 3.6-5 6.8-5z"
            />
          </svg>
        </span>
        {busy ? t("loggingIn") : t("google")}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-red-600">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
