# 2026-09-04: MiniMax M2.5 看圖說故事，UR2.5 AC1 FAIL

## 情境

UR2.5 定稿（3 款＋真名＋智慧隨機，`docs/UR2.5-system-prompt.md` v2）後，
用 MiniMax-M2.5 跑三路徑實測（temperature 0.2，圖 ≤1024px）。

## 問題

格式全 PASS（純 JSON、精確 key、3 款），但品名全靠編：
遠攝回 3 款清酒、近攝（可驗證有 Jameson／Bombay／Forty Creek）回
Johnnie Walker／Glenfiddich／Chivas、塗鴉插畫（零真實商品）回
Tiger／Kakubin／Martell＋success——失敗路徑連 `unclear_image` 都不回。

## 原因

模型 OCR／視覺接地弱＋指令服從不夠硬：酒標讀不出時不認輸，
反而用刻板印象補名字；v2 加的圍欄禁令、範例、逐字規則只修好了格式。
附帶坑：668KB PNG 大圖會空回覆＋`finish: length`（推理食掉 token），
生產環境圖片必須先壓到 1024px／70KB 級。

## 修正

換 Claude API 重測同一矩陣（架構原定，視覺＋服從更強；需用戶給
`ANTHROPIC_API_KEY`）。prompt 本體（v2＋輸出鐵律＋調用參數）保留，
只換模型；若 Claude 過，則 UR2.4 供應商改 Claude。
