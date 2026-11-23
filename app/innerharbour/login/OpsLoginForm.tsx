"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function OpsLoginForm({ nextPath }: { nextPath: string }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error !== null) setErr(error.message);
    } catch (e) {
      setErr((e as Error).message || "Google 登入失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error !== null) setErr(error.message);
      else setSent(true);
    } catch (e) {
      setErr((e as Error).message || "發送驗證碼失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim() || !code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error !== null) {
        setErr(error.message);
      } else {
        window.location.href = nextPath;
      }
    } catch (e) {
      setErr((e as Error).message || "驗證失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
      <button type="button" onClick={() => void handleGoogle()} disabled={busy} style={{ width: "100%", padding: "10px 16px", fontWeight: 700 }}>
        {busy ? "處理中…" : "使用 Google 管理員帳號登入"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#6b7280", fontSize: 12.5 }}>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid #e5e7eb" }} />
        <span>或使用電郵驗證碼</span>
        <hr style={{ flex: 1, border: 0, borderTop: "1px solid #e5e7eb" }} />
      </div>

      {!sent ? (
        <form onSubmit={(e) => void handleSendOtp(e)} style={{ display: "grid", gap: 10 }}>
          <input
            type="email"
            required
            placeholder="管理員電郵"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={busy} style={{ background: "#fff", color: "#111" }}>
            發送電郵驗證碼
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void handleVerifyOtp(e)} style={{ display: "grid", gap: 10 }}>
          <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>已發送驗證碼至 {email}</p>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="輸入電郵驗證碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            驗證並繼續（前往 Authenticator 二次驗證）
          </button>
        </form>
      )}

      {err && (
        <p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}
