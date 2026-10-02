# 2026-10-02 — DEF-20261002-001／002（bar-room 語音＋鍵盤）

## 情境

- 用戶報：iPhone Chrome 上 Ivy Bar 按住對講一直「沒聽清」；打字時鍵盤把 Ivy 整個頂出屏幕。

## 問題

1. 對講鏈是純瀏覽器 `SpeechRecognition`（F.1 已拿掉訊飛 fallback），iPhone 全系（Safari／Chrome 皆 WKWebView）根本無此 API——`webSpeechOnce`（`RoomWalk.tsx:311`）`SR === undefined` 即靜默回 null，三語種輪空，永遠落「沒聽清」分支。用戶無法分辨是權限問題還是瀏覽器不行。
2. `onResize` 只聽 `window.resize`（`RoomWalk.tsx:1052`），iOS 鍵盤只縮 visualViewport、不發 resize——畫布保持全高、面板停在 layout 底部（鍵盤後面），iOS 為露出輸入框整頁 pan，Ivy 被頂飛。既有 `inputFocused` 收消息只減面板高，攔不住系統級 pan。

## 原因

1. 能力檢測缺失＋失敗文案誤導（無 API 卻報「沒聽清」）。
2. 第三方（系統鍵盤）改的是 visualViewport，不是 window——只聽 resize 即漏事件。

## 修正

1. `srSupported`（lazy state，SSR 安全）：`startRecord` 無能力即直說原因不進錄音態；兩顆麥克風鈕 `disabled`＋置灰；語種鎖整組隱藏。
2. `bar-room/page.tsx` 根容器跟 `visualViewport.height` 走（`vv.resize` 訂閱＋卸載清），每次 fit 後手動 `dispatchEvent(resize)` 讓 RoomWalk 既有 `onResize` 重排畫布。桌面端 vv 不變，天然 no-op。
3. 教訓：移動端鍵盤相關一律走 `visualViewport`，`window.resize` 在 iOS 上靠不住。
