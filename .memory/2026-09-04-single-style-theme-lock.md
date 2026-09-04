# 2026-09-04: 黑底之謎＝殘留 flat-illustration，單風格階段必須鎖死主題

## 情境

UR1.5 上線後用戶回報：頁面底是黑的、跟 doodle POC 完全不像。

## 問題

`ThemeProvider` 用 `useState(DEFAULT)` 打頭陣，但 mount 後 `useEffect` 去 localStorage 讀舊選擇覆蓋。用戶在 UR1.2 驗收時選過 `flat-illustration`（`--background: oklch(0.18 …)` 深 navy，觀感即黑底），殘留值一直蓋掉 doodle 預設。白底（nova 殘留）或黑底（flat-illustration 殘留）都可能，看當年選了什麼。

## 原因

單風格階段沒有入口可以換回來，`hydrate stored id` 這個通用機制反而變成 bug：任何歷史選擇都永久劫持首頁視覺，AC2 必掛。

## 修正

1. `lib/themes/registry.ts` 加 `LOCKED_THEME_ID = "doodle"`；provider 以它為初值，hydrate 與 `setThemeId` 在鎖定时直接 return。多主題回歸時設回 `null` 即 revert（一行）。
2. 同次把 demo 貼近度補上：次卡改 teal／粉實底（`bg-secondary`／`bg-accent`，token 驅動）、全卡 2px 墨線、header 虛線、hero 加 wobble 濾鏡＋酒花＋麥穗＋散落氣泡＋cheers 粉影（07 原稿元素）。
3. 教訓：凡是「本階段只有一個選項」的 UX，啟動時就要硬鎖預設，不能信任持久化層的歷史值。
