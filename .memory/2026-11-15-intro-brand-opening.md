# 首屏採用正式品牌 hi drink／嗨飲

## 情境
用戶要求產品名字放在新版介紹頁第一頁，正式英文為 hi drink、中文為嗨飲，指定參考 iOS hi-drink-motion-poc 的 index.html，再製作協調的圖片。沿 UR M.7，保留先前文案重寫、發帖優先、Ivy 後大話骰及手動回看。

## 問題
首屏與導航仍寫 WhatToDrink，沒有正式品牌視覺。品牌稿同目錄同時存在舊 DM Serif 與最新 Cormorant／文楷字標；直接重畫圖示或讓生成模型排字會偏離批准的 h／酒杯／對話泡泡形狀。

## 原因
歷史專案名不等同新產品正式名；原圖顯示又包含特定來源裁切，不能只依縮圖另畫。中文正式品牌是「嗨飲」，簡體語境也不能自行改為「嗨饮」。

## 修正
- 唯讀查看 POC HTML／README、approved-logo-original.png 及最新 bilingual-loading-preview.png。使用最新 wordmark-en.svg（Cormorant Garamond 500）及 wordmark-zh.svg（LXGW WenKai TC）；兩份 OFL 一併保留。五個來源檔與原稿逐位元一致；brand.test.ts 鎖定圖示與字標來源 SHA-256。
- 內建 imagegen 只生成透明琥珀光影（沒有文字、Logo 或新功能宣稱）；scripts/render-intro-brand.mjs 沿 POC `(0,6,320,332)` 裁切及 25% 圓角，合成原圖示、原向量字標，輸出 1400×1400 透明 PNG／WebP、SVG 母稿與深底預覽。素材、prompt.txt、manifest.json、授權及 README 均在 public/intro-next/brand；不依賴預設生成目錄供網頁使用。
- 新首屏保留原功能文案，右側換品牌圖，沿同一影格曲線淡入／輕微推近；頂部改正式圖示與按語言的字標，載入、三語 SEO 標題及開場／結尾品牌同步。首屏圖納入原有有界預載，不改 1.8 秒放行／手動播放語義。窄屏字標限寬，避免英文品牌擠壓操作列。
- alt 已明確寫在 img 上，避免 eslint 無法從 getImageProps spread 辨識而報警。第一輪沙箱 build 持續無輸出且程序 CPU 0，停止該輪自己的程序後，以正常本機權限重跑；1562ms 完成編譯，138 頁建置通過。相關 lint 零錯／零警告；intro 11 檔／122 tests 通過（含來源與品牌名兩項）。
- 同步 CHANGELOG、UR M.7、docs/data/intro-marketing.md、docs/intro-copywriting.md。原版備份、66 張功能圖、iOS 工程、proxy、.env 及遠端均不修改；本機 SITE_LIVE=true 僅程序級，正式站繼續封站。啟動本地預覽供用戶親驗，未以 AI 目檢取代驗收，未提交或推送。
- 沒有本輪暫存檔殘留；保留原生成輸出及專案內成品／母稿／重建器作交付。
- 2026-11-16 續作：前輪最後的本機 HTTP 檢查因自動審批用量限制而未執行，沒有將它記成成功。用戶要求 carry on 後重新啟動本機 server；三語首屏、品牌 WebP／SVG 及 Next 優化圖片皆回應 HTTP 200。正式站封站與 .env 不動，未重複跑已通過且無新程式變更的 gates，未提交／推送；沒有新增暫存檔。
