# 2026-09-13 commit 後不主動起 vercel deploy

## 情境
URC 1.0／URC 1.1 commit + push 完成後，我都順手起 `npm start`（prod server）
給用戶看實機。用戶給出明確偏好。

## 問題
用戶想本地瀏覽器先看（dev 或 prod 都行），不希望 commit 後自動觸發 vercel deploy。
之前的 dev server / prod server 啟動是善意，但**起 server 不是 commit 後的必要動作**——
用戶說「stop localhost」才停下，浪費一輪來回。

## 用戶原話
「next time, after code commit, no need to publish to vercel server. because I want to
review at local server first. ok?」

## 修正
- commit + push 之後**不主動起 server**（dev / prod 都不要）
- 等用戶說 `npm start` / `npm run dev` / 「起 server」才起
- 預設行為停在「commit + push 完成，報備 gates + 狀態，等下一步指令」
- 不變：用戶瀏覽器親眼驗收流程（10a-10b）照舊（用戶自己決定何時起 server 來看）

memory 點：commit → push → 報備 → **等指令**，不主動起服務。
用戶要 deploy 到 vercel 是另一回事（那是 release 階段，不是每個 commit 都做）。