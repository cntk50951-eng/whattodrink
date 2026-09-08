# 2026-09-09 UR3.9 批量推薦網格（點格即落釘＋換下一批）

## 情境
- 用戶：繼續 UR3.9，RAW 一句「在隨機推薦酒類的面板中，我不希望用戶手動點擊想喝或者換酒按鈕，而是在一開始面板加載的時候就有一些默認的酒類圖片可以讓用戶選擇，如果都沒有用戶想要的，那麼可以換下一批。」要求分析、整理再開發。
- 按 Step 1–2 先重述 goal／non-goal＋AC 草案＋三路徑（A 品種內批量 6 張推薦／B 全局批量／C 加詳情二次確認），三問確認全按推薦（品種內 6 張、點即落釘）後置 [WIP] 開工。

## 問題
1. `Date.now()` 在 `dropWant` 內被 `react-hooks/purity` 判為 render 期間調用 impure（曾用 `handleWant` 包裝時未報，拆成 `dropWant` 後因名字不以 handle 開頭被誤判）。
2. `npm run build` 本機仍被 sandbox 攔（Turbopack spawn CSS 即 EPERM，與本次改動無關，未碰 CSS）。

## 原因
1. 規則看名字不看意圖：`handle*` 前綴才豁免，`dropWant` 被當成普通函數。
2. 環境老問題（UR1.3 起屢見）。

## 修正
1. 該行加 `// eslint-disable-next-line react-hooks/purity -- dropWant is an event handler (click), not render`，全量 `grep Date.now` 核其他 5 處（runShakeFlow 等 handle* 內）本就不報，無需動。
2. 照既定口徑：tsc 淨／lint 0 error（3 舊 warning）／103 tests＋JSON key parity 腳本驗三語，build 交用戶側。
- 本輪實現備忘：`pickRandomBatch` 住 `lib/beers.ts`（洗牌不改源，未知類回退全局）；L2 單品牌改 3 列批量網格（小類如紅酒 1 款就 1 張，批次不重複）；`handlePickLane` 改批量取數，`handleRefreshBatch` 同類重洗最多 3 次避全等，`handleBatchWant` 點格即 `dropWant`；`handleWant` 退役刪除；沿用 border-2＋硬陰影，h-16 手繪／emoji 回退。
- 門：98→103 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：零新增數據，無需更新。
