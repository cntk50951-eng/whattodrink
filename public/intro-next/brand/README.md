# hi drink · 嗨飲首屏品牌圖

2026-11-15／UR M.7。三語介紹頁共用雙語官方品牌圖，沒有額外宣傳文字或測試內容。

- `hi-drink-opening-v1.png`：1400×1400 透明成品，可另行排版。
- `hi-drink-opening-v1.webp`：網頁使用，保留透明背景。
- `hi-drink-opening-preview-v1.png`：深底預覽，方便直接查看。
- `hi-drink-opening-v1.svg`：嵌入圖示／背景與原字標輪廓的可攜母稿。
- `approved-logo-original.png`：原檔完整複製；SVG 合成才套 POC 的 `(0,6,320,332)` 顯示裁切及 25% 圓角。`icon.svg` 是同一裁切的導覽圖示。
- `wordmark-en.svg`／`wordmark-zh.svg`：原 POC 最新 Cormorant Garamond 500／LXGW WenKai TC 輪廓；非舊版 DM Serif。字形不經生成模型；對應 OFL 授權隨附。
- `amber-light-v1.png`：內建 imagegen 新生成的透明裝飾光影；提示詞與生成模式在 `prompt.txt`，無文字、無替代 Logo。
- `manifest.json`：名稱、來源、裁切、輸出雜湊；官方中文繁簡均為「嗨飲」。

唯讀來源：`whattodrink_ios/docs/design/hi-drink-motion-poc/index.html` 及相鄰素材；沒有修改 iOS 工程。

重建：在網頁工程根目錄執行 `node scripts/render-intro-brand.mjs`，使用既有 resvg／sharp，不需新依賴或網路。修改輪廓／原圖前須重新核對品牌來源；`brand.test.ts` 鎖定批准的三個原檔 SHA-256。

首屏沿用介紹頁深色氛圍，裝飾光影低對比、四周漸淡，品牌中心保持清楚；動態由 Remotion 影格控制整體淡入／輕微推近，並非將 POC 的啟動畫面或載入進度接進真實 App。
