# 2026-09-05: Leaflet touch-action 覆寫與 FAB 收斂

## 情境

UR1.3 上線後用戶回報：CSS `touch-action: pan-y` 修了，手機豎滑還是被地圖吞掉；
同時要求把所有地圖入口收進單一按鈕（齒輪展開式）。

## 問題

1. CSS 覆寫不可靠：Leaflet 自帶 `touch-action:none` 規則，層疊輸贏看注入順序，
   裝置上經常是它贏——我的 module CSS 明明生成正確（已用 postcss 實證），
   線上依然被蓋掉。
2. 右下按鈕組＋左下 pill＋抽屜三層疊加，可抓的頁面區幾乎為零。

## 原因

第三方庫的「全地圖手勢獨佔」假設跟「嵌在頁面裡的地圖」衝突；
光靠外層 CSS 優先級賭博赢不了運行時行為。

## 修正

1. init 內 `holder.style.setProperty("touch-action", "pan-y pinch-zoom", "important")`：
   inline important 通吃一切 stylesheet（含庫自帶），這才是根治。
   CSS module 那條保留（首繪前生效），雙保險。
2. `MapFab` speed-dial 收斂全部入口（推薦／回位／全港），縮放加減退役
   （雙指＋雙擊保留）；扇形錯峰彈簧、label pills、Esc／拖圖收起、
   想喝紅點（語義態）；skill design read＋偏離聲明寫在檔頭註解。
3. 以後凡是「庫預設行為跟嵌入場景衝突」，優先 JS 顯式覆寫，不賭 CSS 層疊。
