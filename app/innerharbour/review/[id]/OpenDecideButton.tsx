"use client";

/** 點擊：展開右側「判定」面板、捲到可見並聚焦第一個控件（頁頂待辦提示條用）。 */
export default function OpenDecideButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rv-cta"
      onClick={() => {
        const el = document.getElementById("decide");
        if (el instanceof HTMLDetailsElement) el.open = true;
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        el?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true });
      }}
    >
      {label} →
    </button>
  );
}
