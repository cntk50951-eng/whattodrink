# Intro 三語文案編輯入口

實際生效來源：`components/intro-next/copy.json`。

正式站保留 `SITE_LIVE=false`：下列正式路徑部署後仍會跳 coming-soon。產品尚未公開，請在本地 `http://localhost:3000` 預覽；文案檔可於 GitHub 編輯。Vercel 開關或全站路由不需為編寫文案而修改。

- `zh-Hant`：繁體中文；頁面 `/intro`（明確語言入口 `/zh-Hant/intro`）。
- `zh-Hans`：簡體中文；頁面 `/zh-Hans/intro`。
- `en`：英文；頁面 `/en/intro`。
- `/intro-next` 及三語前綴保留預覽，和正式頁共用同一份文案。
- `/intro/artwork`：逐張核對 22 張宣傳圖片；原版在 `/intro-backup`。

## 要編輯的欄位

| JSON 位置 | 顯示位置／寫作提示 |
| --- | --- |
| `title`、`description` | 瀏覽器標題、搜尋與分享摘要 |
| `tagline` | 品牌旁的一句定位 |
| `hero.eyebrow` | 開場小標 |
| `hero.title`、`hero.accent` | 開場兩行主標，accent 是強調行 |
| `hero.sub` | 開場描述，保留 `\n` 表示分行 |
| `hero.post`、`hero.ivy` | 開場兩個功能標籤 |
| `scenes.<場景>.eyebrow` | 每幕小標，不加 01 等序號 |
| `scenes.<場景>.title`、`accent` | 每幕兩行主標 |
| `scenes.<場景>.sub` | 逐行進場的說明，建議兩行；使用 `\n` |
| `scenes.<場景>.detail` | 底部操作流程；保留現有 `→`／`·` 分段數量，對應畫面節奏 |
| `scenes.<場景>.focus` | 畫面操作重點 |
| `end.title`、`accent`、`sub` | 結尾主標與描述 |
| 其餘頂層字串 | 導航、播放／暫停、商店待推出及示意／理性飲酒文字 |

## 畫面順序

開場 → `capture` 拍照選圖 → `edit` 編輯 → `publish` 預覽發布 → `map` 地圖帖子／詳情 → `ivy` Ivy 酒吧 → `cocktail` 選酒譜／材料／跟做／完成 → `dice` 大話骰 → `party` 酒局 → `trail` 足跡記錄／地圖預覽／腳印回放 → `meet` 遇見 → `tonight` 今晚喝什麼 → `cheers` 碰杯 → `home` 主地圖／個人主頁 → 結尾。

照片發布優先，Ivy 及遊戲第二。三語使用相同欄位名稱；請保留 JSON keys 及有效 JSON 格式。三套圖片裡的 App UI 字樣是圖像內容，修改這份網頁文案不會改圖片。跟著調酒是配圖步驟與 Ivy 提示，文案應沿用 App 已有能力。

## 原版備份

Git 標籤 `backup/intro-2026-11-14` 指向替換前版本；完整版本與 SHA-256 清單見 `docs/intro-backup-2026-11-14.json`。原 `components/intro/` 與 `public/intro/` 保持原位，`app/[locale]/intro-backup/page.tsx` 直接使用原播放器。恢復正式頁時可從備份標籤取回 `app/[locale]/intro/page.tsx`。
