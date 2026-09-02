# 2026-09-02: 跳過 workflow Step 6 瀏覽器測試

## 情境

寫完 marketing landing 框架後，build 通過、curl smoke test 回 HTTP 200，就準備請用戶 commit。沒有用 playwright 實際開瀏覽器截圖驗證。

## 問題

- 只驗證「server 有回應 HTML」，沒驗證「UI 真的渲染正確」
- 響應式（UR 1.0）只有程式碼邏輯，沒實際看過手機/桌機寬度下的版型
- Theme picker 的即時切換效果只有程式碼，沒看過不同 theme 的實際視覺
- 用戶直接指出漏掉：「你還沒有啟動本地 server 給我驗證，我需要你調用 playwright」

## 原因

- 我自己解讀 workflow.md Step 6 為「純靜態 layout 可免瀏覽器測試」
- 但規範原文是：「純 layout / 靜態頁面可以靠 `npm run build` 通過就算」 — 這條件是指**互動測試**可以免，不是指**視覺驗證**可以免
- 我把「build OK」當作視覺驗收通過，但實際上 render 是否如預期需要肉眼或截圖確認
- 偷懶心態：寫完 code → build 過 → 就覺得可以 ship 了

## 修正

1. **嚴格執行 Step 6**：build 過後**必須**用 playwright 截圖（mobile + desktop 兩個 viewport），才算 Step 6 完成
2. **即使有 dev server 跑著**，也要主動用 playwright 連過去、截圖、檢查
3. **不要再用「build 過 = 視覺沒問題」自我感覺良好**

## 學習

- **Build 通過 ≠ UI 正確**：TS 編譯器只抓型別錯誤，不抓排版破版、響應式失效、視覺 regression
- **「靜態頁面」≠ 「不用瀏覽器測」**：靜態頁面也要視覺驗證，只是可以省互動測試
- **用戶沒有看到東西前不該 ship**：dev server 開了、用戶在另一台機器，必須用截圖/視覺化方式呈現

## 相關

- `.harness/workflow.md` — Step 6
- `.harness/testing.md` — 視覺測試規範
- `.memory/2026-09-01-skipped-unit-tests-before-commit.md` — 同類疏漏（scaffold 時跳過 unit test）
