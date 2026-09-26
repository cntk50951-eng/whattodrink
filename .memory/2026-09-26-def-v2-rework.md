# 2026-09-26 v2 首驗返工：層級＋全屏＋shadcn 化（DEF-20260926-012）

## 情境

C.1 首驗三連：地圖蓋住按鈕無法操作；不像 shadcn；版式不像截圖且底有 footer。

## 問題

1. 疊加層 `z-10`，Leaflet panes 自帶 z 200–700 直參與全局 stacking——v1 UR1.1 `.above` 同一課重蹈。
2. shadcn 件用了（Button／Card／Badge／Popover／Sheet＋補 Separator），但 `Avatar` 裝不上：本機 bash 工具攔截 `npx`（報 Unknown command），直調二進制下載超時 240s。
3. 根是文档流内 `h-[calc(100svh-3.5rem)]`，header／footer 照常擠佔。

## 原因

1. 寫 v2 時沒把 v1 的 z-index 教訓帶過來（memory 有，沒回顧到此條）。
2. 工具鏈限制非代碼問題：npx 在本環境不可用（memory 應記，供後人）。
3. 全屏需求與「不動 v1 layout」衝突：解法是 v2 根 `fixed inset-0`（v1 文件零動，header／footer 仍在 DOM 但不可達）。

## 修正

- 全部疊加層 `z-[1000]`＋根 `isolate`（portal sheet z-50 在 body 層照上）；tab bar 全寬底欄；pin 卡／CTA 列就位。
- Avatar 改現成 primitives（圓＋ring＋Badge），registry 重試記 C.x。
- 三閘綠；請用戶硬刷新驗（前兩輪修完疑似看的舊 bundle）。

## 教訓

- 開新地圖頁先立 z-index 規矩（panes 200–700 是全局的），不是樣式是功能。
- npx 在本機不可用：以后裝包走「用戶本地執行＋贴命令」或另議通道，不在本機空轉 240s。

## 追補 round-2（同輪四點）

- 自適應：Leaflet 不跟容器變化，轉屏／視口縮放必調 `invalidateSize`，否則瓦片錯位（新頁 checklist 加一條）。
- 頂部重組：兩段 absolute 留縫＋不對齊 → 收進單容器（頭像＋城市左對齊行＋pills＋足跡浮條流式），重疊類 bug 用結構消滅，不用數字調。
- 空 edit 事故：無意義的空白 edit 把 `useEffect` 吞進註釋行，lint／build 雙紅才捉——以後不做無語義 edit；同文件多刀後先跑 lint 再繼續。

## 追補 round-3

- 弹窗殘留三處手搓 button（模式行／tab 足跡／批量卡內鈕）：grep `<button` 全倉掃，v2 歸零。
- 主色去橘改墨黑：用户拍板（Snap 黑白極簡），skill 示例琥珀让路，已同步三 skill 文件。
- 漏關 `</Card>`：JSX 大改後必跑 lint＋build 雙驗（lint 先捉 parsing，build 再捉類型）。

## 追補 round-4

- 用戶不要黑：主色改 shadcn 官方 Blue 主題（registry `themes.ts` Blue light，primary＋近白偏藍字，有據非自創；Snap 同系藍）。琥珀→墨黑→官方藍，兩次轉向皆用戶拍板，skill 跟著改不超前。
- 相機圓鈕同步變藍（bg-primary，同系，無需特判）。

## 追補 round-5

- 用戶不要任何底色：v2 按鈕面全中性（outline 白描邊／secondary 淺灰選中態），primary token 留備用不用；skill 用色條同步三文件（token 有據＋面去色並存，不矛盾）。
- 選中態用淺灰 secondary 而非實心色，是去色體系下的層級答案。

## 追補 round-6

- 去色類修完必 grep 驗收（`bg-primary`／`variant="default"` 全倉掃），本輪即捉 pills 首颗漏網。
- 剩餘藍：8px 牆 Badge 點（默認 variant，用戶未點名，留）。

## 關聯（不變）

- 缺陷：DEF-20260926-012（Fixing）；關聯 UR C.1 [WIP]
