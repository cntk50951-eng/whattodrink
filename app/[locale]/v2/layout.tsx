import type { Viewport } from "next";
import type { ReactNode } from "react";

/**
 * UR C.12 v2 獨立 layout（v1 零影響的位子）。
 *
 * viewport 鎖整頁縮放（`maximum-scale=1, user-scalable=no`）：
 * 底部 overlay 全是默認 touch-action，捏合起點落在它們身上時瀏覽器
 * 直接整頁放大、Leaflet 碰都碰不到；疊加地圖容器被 C.1 放行 pinch，
 * 圖上捏合也在 race。鎖死後任何位置捏合都只剩地圖可縮。
 * 代價：無障礙縮放沒了（用戶拍板 A 時已知）；切回 v1 首頁即恢復。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function V2Layout({ children }: { children: ReactNode }) {
  return children;
}
