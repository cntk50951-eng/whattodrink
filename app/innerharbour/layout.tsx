import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false } };

/**
 * 後台統一樣式：站點全局樣式（Tailwind preflight）會去掉 input／select／textarea／button 的邊框與背景，
 * 後台頁沒有自己的組件庫，這裡給原生表單控件補上可見的樣式（只作用在 .ops 容器內，不影響前台）。
 */
export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ops" style={{ background: "#fff", color: "#111", minHeight: "100vh" }}>
      <style>{`
        .ops input, .ops select, .ops textarea {
          border: 1px solid #888; border-radius: 6px; padding: 8px 10px; background: #fff; color: #111;
          font: inherit; box-sizing: border-box;
        }
        .ops input:focus, .ops select:focus, .ops textarea:focus { outline: 2px solid #2563eb; outline-offset: 1px; }
        .ops button {
          border: 1px solid #111; border-radius: 6px; padding: 8px 16px; background: #111; color: #fff;
          font: inherit; cursor: pointer;
        }
        .ops button:disabled { background: #ccc; border-color: #ccc; color: #666; cursor: not-allowed; }
        .ops a { color: #2563eb; text-decoration: underline; }
        .ops table { border-collapse: collapse; }
        .ops th, .ops td { border-bottom: 1px solid #ddd; text-align: left; }
      `}</style>
      {children}
    </div>
  );
}
