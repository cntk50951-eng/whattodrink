"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { normalizeTotp } from "@/lib/totpInput";

type Mode = "loading" | "verify" | "enroll" | "error";

/** TOTP：已有已驗證因子 → 輸碼驗證（也用於 step-up）；沒有 → 先註冊（QR＋手動密鑰）再驗證。 */
export default function MfaPanel({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const supa = createClient();
      const { data, error } = await supa.auth.mfa.listFactors();
      if (error !== null) {
        setMode("error");
        setMsg("讀取驗證因子失敗，請重新登入後再試");
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified !== undefined) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // 清掉殘留的未驗證因子，避免重複註冊。
      for (const f of data.all.filter((x) => x.factor_type === "totp" && x.status === "unverified")) {
        await supa.auth.mfa.unenroll({ factorId: f.id });
      }
      const enr = await supa.auth.mfa.enroll({ factorType: "totp", friendlyName: "admin" });
      if (enr.error !== null || enr.data === null) {
        setMode("error");
        setMsg("建立驗證因子失敗");
        return;
      }
      setFactorId(enr.data.id);
      setQr(enr.data.totp.qr_code);
      setSecret(enr.data.totp.secret);
      setMode("enroll");
    })();
  }, []);

  async function submit() {
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMsg("");
    const supa = createClient();
    const ch = await supa.auth.mfa.challenge({ factorId });
    if (ch.error !== null || ch.data === null) {
      setBusy(false);
      setMsg("驗證失敗，請重試");
      return;
    }
    const v = await supa.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
    setBusy(false);
    if (v.error !== null) {
      setMsg("驗證碼不正確");
      setCode("");
      return;
    }
    window.location.replace(next);
  }

  if (mode === "loading") return <p>載入中…</p>;
  if (mode === "error") return <p role="alert">{msg}</p>;
  return (
    <div>
      {mode === "enroll" ? (
        <>
          <p style={{ color: "crimson" }}>掃碼後請<strong>不要重新整理本頁</strong>——重新整理會生成新的二維碼，舊的就失效了。</p>
          <p>首次使用：用驗證器 App（如 Google Authenticator、1Password）掃描二維碼，再輸入 6 位驗證碼。</p>
          {/* data: URI 的 SVG，經 <img> 載入不會執行腳本 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="TOTP 二維碼" width={192} height={192} />
          <p style={{ fontSize: 12, wordBreak: "break-all" }}>無法掃碼時手動輸入密鑰：{secret}</p>
        </>
      ) : (
        <p>請輸入驗證器 App 裡的 6 位驗證碼。</p>
      )}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(normalizeTotp(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        aria-label="6 位驗證碼"
        style={{ fontSize: 24, letterSpacing: 6, width: 180 }}
      />{" "}
      <button type="button" onClick={() => void submit()} disabled={busy || code.length !== 6}>
        驗證
      </button>
      {msg !== "" && (
        <p role="alert" style={{ color: "crimson" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
