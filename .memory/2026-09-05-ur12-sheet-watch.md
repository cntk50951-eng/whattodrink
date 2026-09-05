# 2026-09-05: UR1.2 抽屜＋watch 的可測化拆分

## 情境

UR1.2 要 bottom sheet（拖拽收起）＋watchPosition 實時跟隨，前者在 React 裡
全是手勢＋動畫，後者綁死 `navigator.geolocation`，兩邊都難單測。

## 問題

直接寫在組件／hook 裡的邏輯測不了；硬測要裝 jsdom＋testing-library，
為一個 POC 太重。

## 原因

可測與不可測沒分層：watch 的「協議處理」（成功→LatLng／報錯→code／
stop 冪等）其實跟瀏覽器無關，是純邏輯。

## 修正

1. `lib/geoWatch.ts`：`startWatch(source, callbacks, timeout)` 只依賴
   `WatchSource` 最小接口（跟 Geolocation 同形），生產傳
   `navigator.geolocation`，測試傳假對象——3 個 test 覆蓋轉發／code／冪等 stop。
2. hook 只剩裝配（啟停時機、visibility 暫停、attempt 競態），靠 tsc＋真機驗。
3. 抽屜拖拽：手勢中直接寫 DOM transform（不經 React state，不重渲染），
   鬆手清 transform 靠 CSS transition 做 snap-back 動畫；閾值抽常數
   `SHEET_DISMISS_DY`。同模式以後抽屜類 UI 照抄。
4. 鏡頭讓位不用兩段式動畫：`project→subtract→unproject` 一次算出偏移目標，
   一個 flyTo 到位。
