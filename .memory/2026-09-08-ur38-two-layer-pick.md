# 2026-09-08 UR3.8 兩層推薦面板（L1 品種＋L2 品牌）

## 情境

- 用戶：繼續 UR3.8，backlog 只有需求＋與設計師的討論原文，要求深度理解、整理並實現。
- 按 Step 1–2 先重述 goal／non-goal＋AC 草案＋思考摘要（三路徑 A 增量／B 抽組件／C filter chips），三問確認（L1 分類／換品種行為／UR 寫法）全按推薦選項拍板後開工。

## 問題

1. `dropWant` 共用核心註解誤寫簡體「见」（从 L2 複製句式時混入）。
2. backlog 拼接後 UR3.7／3.8 交界多出 3 個空行（splice 時 `"\n" + new` 疊加原文空行）。
3. `npm run build` 本機仍被 sandbox 攔（Turbopack 起 process 掃 CSS 即 EPERM，與本次改動無關，未碰任何 CSS）。

## 原因

1. 中英混寫註解手寫，無 lint 可攔。
2. 行號 splice 時沒數原文尾空行。
3. 環境老問題（UR1.3 起屢見，Turbopack spawn 被禁）。

## 修正

1. 改英文 "see"，全文 grep 無其他簡體混入（`never见` 唯一）。
2. python 按行號刪多餘空行，`grep UR3.8開始|結束` 歸零確認 raw 清乾淨。
3. 照既定口徑：tsc 淨／lint 0 error／98 tests＋JSON key parity 腳本驗三語，build 交用戶側。
- 本輪實現備忘：映射單源住 `lib/beers.ts`（新品牌補 match 行即生效）；L1 每類＋鈕走 `handleLaneWant`→`dropWant`，L2 想喝走 `handleWant`→`dropWant`，pin／卡／足跡只見真品牌；單品牌類換一款 10 次兜底沿 UR3.7；`pickAgain` key 退役留空（無引用的多餘 key 不報錯，就不刪減 churn）。
- 門：90→98 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：零新增數據，無需更新。
