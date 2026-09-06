# 2026-09-06 — Dropdown Menu（Base UI Portal）從 header 開，要 z-index 高過 Leaflet pane

## 情境
UR1.7 頂部選單上線驗收：用戶開啟漢堡選單，下拉選單被地圖瓦片蓋住，看起來像「消失」。

## 問題
- 選單在 header，下拉從 `MenuPrimitive.Portal` 進 body
- DropdownMenu Positioner 預設 `isolate z-50`
- Leaflet panes：tiles 200 / overlay 400 / shadow 500 / marker 600 / popup 700 / controls 800/1000
- React 覆蓋層 `.above` 也是 z-1000
- 結果：body stacking context 裡 dropdown z-50 全面輸給 z-200+ 的地圖元素

## 原因
2026-09-05 那篇 memory 只覆蓋**地圖內部**的 React 覆蓋層（`.above`），沒提**外部 portal-from-sibling** 的同族問題。Base UI Popover / DropdownMenu / Sheet / Dialog 的 Portal 雖然到 body，自身 stacking context 仍受 Positioner 的 z-index 控制——預設值 z-50 對上任何 Leaflet 場景都會輸。

## 修正
1. `components/ui/dropdown-menu.tsx` 把 Positioner + Popup 的 `z-50` 統一改 `z-[1100]`（在 1000 之上留 100 餘量），加註解標明 Leaflet pane 範圍，下次維護不會憑直覺寫回 `z-50`。
2. 在 UI primitive 層改，不是 HeaderMenu 層改——任何 Base UI dropdown 都受益，不需要每個使用點都修。
3. 驗證：grep `.next/dev/static/chunks/*.css` 確認 `.z-\[1100\] { z-index: 1100; }` 真的編進去。Tailwind v4 arbitrary 簡單數字 OK；複雜函數 `max(env(...))` 會被掃描器靜默丟掉（見 2026-09-05-tailwind-arbitrary-dropped）。
4. 教訓整合：當作 UR1.7 / leaflet-overlay 兩篇的補充——任何 Leaflet / MapLibre 同框的 portal UI（Popover / DropdownMenu / Sheet / Dialog），第一時間就上 `z-[1100]+`，不要等驗收。

## 相關
- `.memory/2026-09-05-leaflet-overlay-zindex.md` — 地圖內部 React 覆蓋層的 `.above` 規範
- `.memory/2026-09-05-tailwind-arbitrary-dropped.md` — 任意類掃描器陷阱
- `components/ui/dropdown-menu.tsx` — 改的位置
- `components/marketing/HeaderMenu.tsx` — 第一個踩到的使用點
