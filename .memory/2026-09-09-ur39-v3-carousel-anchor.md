# 2026-09-09 UR3.9 v3 返工（直達開板＋照片輪詢＋錨定卡遮擋）

## 情境
- 用戶驗收返工三點：點啤酒鈕開板不見酒（空 CTA，要再點一次）；輪詢無滑動感、像 list；打卡卡被地圖下緣遮擋、大小佈局有問題。

## 問題
1. 啤酒鈕 `onPick` 只 `setSheetOpen(true)`，`pickLanes` 仍 false → 首屏是空 CTA，第二步才見酒，違 RAW「一開始就有酒」。
2. L2 是 3 列靜態網格，無滑動手勢、無進場動畫，看感＝list。
3. 錨定卡量高只在掛載量一次（callback ref）；展開換酒批次後卡變高，錨點仍用舊矮值 → 下緣頂出地圖被裁。

## 原因
1. v1 保留 CTA 作入口，開板路徑沒跟著改。
2. 批量網格只求點選，沒做輪詢體感。
3. 量高機制假設「內容換＝remount」，換酒批是同卡內展開，不 remount。

## 修正
- 新增 `openPickSheet()`（`setPickLanes(true)`＋`setSheetOpen(true)`），啤酒鈕／`?pick=1`（含初值＋transition effect）／空足跡 CTA 全走它；空 CTA 留作兜底。
- L2 改照片輪詢：`w-[78%]` 主角卡＋peek 下一張＋snap＋左右箭頭（卡寬步進，reduced 走 auto）＋點點（`onScroll` 回寫 `batchIndex`，只在變化時 set）；換批 key 重掛重播 `batchIn`；L1 卡加 `laneIn`＋60ms stagger＋`scroll-smooth`；動畫全是 from-only keyframes（不吃 rotate 妝），reduce 媒體全關。
- 錨定卡：`measureRef` 改 `ResizeObserver`（四捨五入防抖動，unmount 斷開，SSR 守衛 `typeof`），開批／刪確認／乾杯收據變高即重錨；卡內包 `overflow-y-auto`＋`maxHeight = view.ch - 56`（X 貼紙與尾巴留外層不動），極端情況內滾不頂出。
- `pickPrev`／`pickNext` 三語。門：105 tests／tsc 淨／lint 0 error（3 舊 warning）。9b：零新增數據，無需更新。
