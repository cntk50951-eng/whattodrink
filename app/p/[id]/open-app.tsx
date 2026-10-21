"use client";

import { useEffect, useState } from "react";

/**
 * 「在 App 打開」：頁面載入後在 iOS 上自動嘗試一次深鏈；1.8 秒後頁面仍在前台＝沒裝 App（或被擋），
 * 這時如果有下載連結就高亮下載按鈕。自動嘗試只做一次，不循環，避免反覆彈「是否打開」。
 */
export function OpenApp({ deepLink, storeUrl }: { deepLink: string; storeUrl: string | null }) {
  const [stayed, setStayed] = useState(false);
  useEffect(() => {
    if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    let left = false;
    const onHide = () => { left = true; };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    const t1 = window.setTimeout(() => { window.location.href = deepLink; }, 250);
    const t2 = window.setTimeout(() => { if (!left && document.visibilityState === "visible") setStayed(true); }, 2200);
    return () => {
      window.clearTimeout(t1); window.clearTimeout(t2);
      document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onHide);
    };
  }, [deepLink]);
  return (
    <div className="actions">
      <a className="btn primary" href={deepLink}>在 App 打開</a>
      {storeUrl !== null ? (
        <a className={stayed ? "btn primary soft" : "btn ghost"} href={storeUrl}>{stayed ? "未安裝？下載 App" : "下載 App"}</a>
      ) : (
        <p className="note">App 即將上架；已安裝的朋友點上面按鈕就可以直接打開。</p>
      )}
    </div>
  );
}
