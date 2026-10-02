/**
 * POC 房間漫遊頁（`/bar-room`，獨立：Hunyuan 房間 GLB 第一人稱 demo）。
 * v1 零文件；doubleSide＋碰撞＋1.6m 眼高；失敗顯示原因（不黑屏）。
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { RoomWalk } from "@/components/bar-room/RoomWalk";

export default function BarRoomPage(): React.JSX.Element {
  const [note, setNote] = useState("載入中…");
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // iOS 鍵盤只縮 visualViewport、不發 window.resize：根容器跟著縮，
    // 底部面板自然浮到鍵盤上，系統就不會整頁 pan 把 Ivy 頂飛。
    // （DEF-20261002-002；桌面端 vv 高度不變，天然 no-op）
    const root = rootRef.current;
    const vv = window.visualViewport;
    if (root === null || vv === null || vv === undefined) return;
    const fit = (): void => {
      root.style.height = `${vv.height}px`;
      // RoomWalk 的 onResize 只聽 window.resize，手動補一次讓畫布重排。
      window.dispatchEvent(new Event("resize"));
    };
    fit();
    vv.addEventListener("resize", fit);
    return () => vv.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={rootRef} className="fixed inset-0 overflow-hidden bg-black text-white">
      <div className="absolute left-3 top-3 z-20 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold tracking-wide text-amber-200 ring-1 ring-white/15 backdrop-blur">
        POC-BAR-ROOM · {note}
      </div>
      <div className="absolute left-1/2 top-3 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-center text-[11px] text-white/80 backdrop-blur">
        拖拽看 · WASD 走 · 手機左半走右半看
      </div>
      <RoomWalk
        onReady={(ok, msg) => setNote(ok ? msg : `失敗：${msg}`)}
      />
    </div>
  );
}
