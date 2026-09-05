# 2026-09-05: Leaflet 上疊 React 覆蓋層必須顯式 z-index

## 情境

UR1.1 地圖上線後用戶驗收：隨機推薦入口按鈕「不見了」，點自己的 pin 沒反應。

## 問題

1. 入口面板、縮放按鈕、badge 全是 `absolute`＋z-index auto，被 Leaflet 的
   panes（tile 200 … marker 600 … popup 700，controls 800/1000）壓在下面，
   瓦片不透明→看起來像整個覆蓋層消失；只有 Leaflet 自己的 markers 可見可點。
2. 自己 pin 的 click handler 只是 `setSelectedId(null)`——設計上就是「無反應」。

## 原因

`.leaflet-container` 本身不建 stacking context，panes 的正 z-index 直接參與
外層排序；z-auto 的後來 sibling 也排不贏正 z-index。這是 Leaflet 眾所周知的坑，
但寫的時候沒想到——面板在 SSR 空狀態下看起來正常，有瓦片才被蓋住。

## 修正

1. `drink-map.module.css` 加 `.above{z-index:1000}`（註解寫明 panes 範圍），
   所有 React 覆蓋層掛上；另加 `.paper` 圓點紙紋（z 500，tiles 上、pins 下）。
2. 自己 pin 改彈 self 卡（`SELF_ID` sentinel＋`card` 聯合型別），內含推薦按鈕，
   接回 journey 入口。
3. 之後任何 Leaflet／MapLibre 上疊自繪 UI，第一時間上 z-index，不要等驗收發現。
