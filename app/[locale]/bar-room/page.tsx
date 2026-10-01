/**
 * POC 房間漫遊頁（`/bar-room`，獨立：Hunyuan 房間 GLB 第一人稱 demo）。
 * v1 零文件；doubleSide＋碰撞＋1.6m 眼高；失敗顯示原因（不黑屏）。
 */

"use client";

import { useState } from "react";

import { RoomWalk } from "@/components/bar-room/RoomWalk";

export default function BarRoomPage(): React.JSX.Element {
  const [note, setNote] = useState("載入中…");
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <div className="absolute left-3 top-3 z-20 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold tracking-wide text-amber-200 ring-1 ring-white/15 backdrop-blur">
        POC-BAR-ROOM · {note}
      </div>
      <div className="absolute bottom-3 left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-center text-[11px] text-white/80 backdrop-blur">
        拖拽看 · WASD 走 · 手機左半走右半看
      </div>
      <RoomWalk
        onReady={(ok, msg) => setNote(ok ? msg : `失敗：${msg}`)}
      />
    </div>
  );
}
