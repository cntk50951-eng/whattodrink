# Intro 三語文案編輯入口

實際生效來源：`components/intro-next/copy.json`。

品牌正式名稱為 `hi drink`／`嗨飲`（繁簡均保留「嗨飲」）。首屏雙語品牌圖片在 `public/intro-next/brand/hi-drink-opening-v1.png`，與網頁功能介紹文案分開；修改 `hero.*` 不會改動圖片內向量字標。圖示／字標依 iOS hi-drink-motion-poc 定稿，來源與重建方式見同目錄 README。

正式站保留 `SITE_LIVE=false`：下列正式路徑部署後仍會跳 coming-soon。產品尚未公開，請在本地 `http://localhost:3000` 預覽；文案檔可於 GitHub 編輯。Vercel 開關或全站路由不需為編寫文案而修改。

- `zh-Hant`：繁體中文；頁面 `/intro`（明確語言入口 `/zh-Hant/intro`）。
- `zh-Hans`：簡體中文；頁面 `/zh-Hans/intro`。
- `en`：英文；頁面 `/en/intro`。
- `/intro-next` 及三語前綴保留預覽，和正式頁共用同一份文案。
- 裸 `/intro`／`/intro-next` 及圖庫固定以繁體進入，不採用舊 NEXT_LOCALE 或 Accept-Language；英文／簡體請使用明確前綴，刷新後保持該語言。此規則不套用其他 App 路由或原版備份。
- `/intro/artwork`：逐張核對 22 張宣傳圖片；原版在 `/intro-backup`。

## 要編輯的欄位

| JSON 位置 | 顯示位置／寫作提示 |
| --- | --- |
| `title`、`description` | 瀏覽器標題、搜尋與分享摘要 |
| `tagline` | 品牌旁的 slogan：分享一杯，遇見同好 · AI 更懂你的口味；三語聚焦分享／交友樂趣與 AI 口味理解 |
| `hero.eyebrow` | 開場小標 |
| `hero.title`、`hero.accent` | 開場兩行主標，accent 是強調行；現行主張「每一杯，都是一個故事」（不強調地圖），見 `.memory/2026-11-16-intro-positioning.md` |
| `hero.sub` | 開場描述，保留 `\n` 表示分行 |
| `hero.post`、`hero.ivy` | 開場兩個功能標籤 |
| `scenes.<場景>.eyebrow` | 每幕小標，不加 01 等序號 |
| `scenes.<場景>.title`、`accent` | 每幕兩行主標 |
| `scenes.<場景>.sub` | 逐行進場的說明，建議兩行；使用 `\n` |
| `scenes.<場景>.detail` | 底部操作流程；保留現有 `→`／`·` 分段數量，對應畫面節奏 |
| `scenes.<場景>.focus` | 畫面操作重點 |
| `end.title`、`accent`、`sub` | 結尾主標與描述 |
| `browse.*` | 手動瀏覽：前後畫面、功能選單、滑動／暫停提示與開場／結尾名稱；功能選單使用 scenes 的 eyebrow |
| 其餘頂層字串 | 導航、播放／暫停、商店待推出及示意／理性飲酒文字 |

## 畫面順序

開場 → `capture` 拍照選圖 → `edit` 編輯 → `map` 地圖帖子／詳情 → `ivy` Ivy 酒吧 → `dice` 大話骰 → `cocktail` 選酒譜／材料／跟做／完成 → `party` 酒局 → `trail` 足跡記錄／地圖預覽／腳印回放 → `meet` 遇見 → `tonight` 今晚喝什麼 → `cheers` 碰杯 → `home` 主地圖／個人主頁 → 結尾。

照片發布優先，Ivy 及遊戲第二。三語使用相同欄位名稱；請保留 JSON keys 及有效 JSON 格式。三套圖片裡的 App UI 字樣是圖像內容，修改這份網頁文案不會改圖片。跟著調酒是配圖步驟與 Ivy 提示，文案應沿用 App 已有能力。

介紹頁底部已移除圖庫／原版連結，只保留示意與理性飲酒文字。播放時可左右滑動、用前後箭頭／鍵盤逐張回看，或點目前功能名稱直接選段；手動選擇後停播，按播放繼續。原生選單顯示各幕 eyebrow，建議保持短且可區分（拍照／修圖／上地圖等）。

普通 `/intro` 自動播放。`?t=2.8` 表示從 2.8 秒開始並繼續播放；製作文案截圖時才加 `?t=2.8&preview=1` 明確凍結。請給用戶普通入口作播放驗收，避免用靜態預覽測試自動播放。播放器為無聲動畫，初始化靜音；減少動態偏好仍預設停在完整結尾，可自行按播放。

## 原版備份

Git 標籤 `backup/intro-2026-11-14` 指向替換前版本；完整版本與 SHA-256 清單見 `docs/intro-backup-2026-11-14.json`。原 `components/intro/` 與 `public/intro/` 保持原位，`app/[locale]/intro-backup/page.tsx` 直接使用原播放器。恢復正式頁時可從備份標籤取回 `app/[locale]/intro/page.tsx`。
