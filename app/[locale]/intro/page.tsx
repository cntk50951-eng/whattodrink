import type { Metadata, Viewport } from "next";

import { IntroClient } from "@/components/intro/IntroClient";

/**
 * 首頁介紹頁（裸 `/` 的默認落點，見 lib/home.ts）。
 * 全屏自動播放、循環的產品故事線（Remotion Player＋真機截圖）；右上常駐 App Store／Google Play。
 * 內容為英文（對齊 iOS 目錄 en 措辭）；三語待 messages 接入。
 */
export const metadata: Metadata = {
  title: "WhatToDrink — What to drink tonight?",
  description:
    "Discover bars, follow friends’ trails and meet over a drink. Get the WhatToDrink app on iOS and Android.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF8F1",
};

export default function IntroPage() {
  return (
    <>
      {/* 動畫由 JS 渲染；這段文字供搜索引擎、讀屏與無 JS 環境 */}
      <h1 className="sr-only">WhatToDrink — What to drink tonight?</h1>
      <p className="sr-only">
        Discover bars, follow friends’ trails and meet over a drink. Check in with a snapshot, search people in one
        sentence, chat, raise a glass, find nearby bars and play drinking games. Available on iOS and Android.
      </p>
      <IntroClient />
    </>
  );
}
