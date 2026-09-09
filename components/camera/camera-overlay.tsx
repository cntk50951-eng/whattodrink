"use client";

import { useRouter } from "next/navigation";

import { CameraFlow } from "./camera-flow";

/**
 * UR4.1 v6 拍照分享搬上地圖：`/?shoot=1` 蓋全屏層，地圖常駐底下不卸載。
 * 關層＝清參數回 "/"（CameraFlow 卸載即停流）；層內成功頁不跳 /wall。
 * 獨立 /camera 頁保留作 fallback，不動。
 */
export function CameraOverlay() {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-[1300] overflow-y-auto bg-background p-4 md:p-6">
      <CameraFlow autoStart onClose={() => router.push("/")} />
    </div>
  );
}
