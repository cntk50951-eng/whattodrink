# 2026-09-26 workflow.md 修正：AI 主動起 dev server 給作者驗

## 情境
前一天決定「commit 後 AI 不主動起 server」（2026-09-13）。
同日稍晚用戶改 workflow 預設跳過自動測試（2026-09-26-default-skip-auto-tests），
Step 6 改成作者手動驗，但 Step 10a 仍寫「AI 不主動起 dev server」——
矛盾：作者要手動驗但要作者自己起 server 才能驗。

## 用戶原話
「Auto start dev server instead of author to start. Because this could streamline
the manual test start off which replaced the auto test.」

邏輯：手動測試需要 dev server 跑著，AI 起比作者自己 `npm run dev` 順。

## 修正
- Step 10a：AI 啟動 dev server（背景），作者用瀏覽器手動驗
- 驗收完成後 AI 停 dev server（背景 task stop）
- 不再要求作者自己 `npm run dev`

## 跟 2026-09-13 memory 的關係
- 2026-09-13 memory：「commit+push 後**不主動起 server**（dev / prod 都不要），
  等用戶指令才起」
- 2026-09-26 修正：「commit + push **後**不起 server；commit 之前**作者 review 階段**
  AI 主動起 server」
- 細分時機：
  - 開發完成 / 含 UI 變更要作者 review → AI 起 dev server（背景）
  - 作者說「OK 可以 commit」 → commit + push + **stop** dev server
  - 任何純文檔 / config 變更（不需 review） → AI 不起 server

## 教訓
用戶偏好是分階段的：「不起 server」是針對 commit 完成後的階段，不是全部階段。
寫 memory 時要把時機拆清楚，不能把整個 process 都標「不起 server」。