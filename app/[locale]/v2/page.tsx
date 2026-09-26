import { V2Home } from "@/components/v2/V2Home";

/**
 * UR C.1 v2 首頁（Snap Map 式 shadcn 重排）。
 * EPIC C 鐵律：本路由只掛 v2 文件；v1 首頁（`app/[locale]/page.tsx`）一字不動。
 */
export default function V2Page() {
  return <V2Home />;
}
