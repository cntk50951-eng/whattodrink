# 2026-11-26 / 送審宣傳圖不可標註「實機畫面 / Real UI」

## 情境
製作 iOS App Store Header and Search Results 預覽圖（`public/appstore-assets/header-search-results.html`），方案 A 手機下方膠囊標籤寫了「實機畫面 · … / Real UI · …」。

## 問題
用戶指出圖片內展示的是依功能設計的宣傳畫面，不是實機截圖，不可寫「實機畫面」。

## 原因
忽略了 `/intro` 既有口徑（`copy.json` 的 `screenshotNote` 明確為「畫面依實際功能設計 · 示範內容」），在 App Store 送審素材上若宣稱「實機畫面」既不準確也有審核合規風險。

## 修正
已從方案 A 繁／簡／英三語圖片內的底部標籤移除「實機畫面 / 实机画面 / Real UI」，僅保留核心功能名稱（`約局 · 拍照發帖 · 嗨飲酒吧 Ivy` / `Meetups · Photo Posts · hi drink Bar`）。日後所有 App Store／宣傳圖均不標註「實機畫面」或「Real UI」。

## 補充（App Store Connect 槽位與安全區）
- **Header（產品頁頂部大圖）** 與 **Search Results（搜尋結果卡片）** 在實務上按兩個獨立位置分別上傳：`3840×1646`（21:9）與 `3840×2560`（3:2），均須為無透明通道 RGB PNG（`hasAlpha=false`）。
- `3840×1646` Header 主視覺必須嚴格鎖在 Apple 官方中央安全區 `1646×661 @ (1097, 493)`（`X: 28.57%..71.43%`, `Y: 29.95%..70.11%`），避免 iPhone 直屏自動裁切左右兩側。
- **App Store Screenshots「iPhone with Dynamic Island」預設必填槽位**（Medium Display，覆蓋 iPhone 16 Pro / 16 / 15 Pro / 15 / 14 Pro）接受 **`1206 × 2622`**（或 `1179 × 2556`），上傳 `1320 × 2868` 會報 `File dimensions are invalid`（`1320 × 2868` 屬 Large Display 槽位）。
- **約局地點口徑更正（2026-11-27）**：宣傳圖約局標語不再寫「只約認證酒吧 / Verified Bars Only」，統一改為 **`約局 · 只約公共場所`** / **`约局 · 只约公共场所`** / **`Meetups · Public Places Only`**。



