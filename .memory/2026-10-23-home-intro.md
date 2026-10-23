# 首頁默認進介紹頁 `/intro`（2026-10-23）

- 用戶要求主頁默認路由到介紹動畫頁，且兼容手機瀏覽器。`HOME_UI` 缺省由 v2 改為 intro（`lib/home.ts`＋單測）；`/v2` 網頁版 App 不動，介紹頁右上有「Open web app」入口。
- 動畫源碼在 iOS repo `docs/design/home-scrolly/`（真機錄屏素材與取捨說明在其 `shots/README.md`）；web 側為移植版 `components/intro/`（`kit.tsx`／`story.tsx`／`IntroPlayer.tsx`），截圖在 `public/intro/shots/`。改動畫兩邊要同步。
- 手機兼容要點：Player 只在瀏覽器端（`dynamic ssr:false`）；尺寸量容器而非 `innerHeight`；觸屏降 30fps；字體加進根 layout 的 Google Fonts link（頁內 `<link>` 會被 lint 判單頁字體）。
- 老 v1 頁面（`/wall`、`/mood`、`/camera`、`/terms`）的「回首頁」連結指向 `/`，現在會落到介紹頁。
- 待辦：商店鏈接占位；三語文案；缺素材（誰是臥底對局、大話骰房內、碰一碰成功、有內容的酒局列表）。
