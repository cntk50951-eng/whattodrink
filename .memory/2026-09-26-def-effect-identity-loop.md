# 2026-09-26 新對象進effect deps致無限循環（DEF-20260926-006，P0）

## 情境

005 fix 把 `apiPinToCheckin(...)` 直接放在 render 的 card 派生里；之後點真 pin 地圖徹底凍死，Console／Network 零報錯。

## 問題

每 render 產新 `card` 對象 → view snapshot effect（deps `[mapReady, card, focusAt]`，`focusAt` 跟 card 走同樣每輪新）每輪 cleanup＋重跑＋`setView` → 新 render → 無限循環吃滿主線程。MOCK 路徑因表引用穩定從不受影響，故此前無此現象——新對象＋舊 deps 是經典組合。

## 原因

派生位（render body）與訂閱位（effect deps）對「對象 identity 穩定性」假設不一致：派生每次新建，訂閱以為是穩定值。

## 修正

- api 卡 `useMemo([selectedId, apiPins])` 凍住 identity；`nowMs` 會話級穩定故意不列 deps（卡開期間 onlineAt 凍結可接受，卡一拖即關）。
- 教訓：凡進 effect deps 的派生對象，必須 memo 或取穩定引用；review 時見到「effect deps 含 render 內新建對象」直接打回。考慮將此升為 `.harness/` 規範（與 UR2.9 refs 規則同級）。
- 三閘綠；用戶瀏覽器覆蓋（點真 pin 開卡＋地圖可操作）。

## 關聯

- 涉及：`components/map/DrinkMap.tsx`（apiCard useMemo）
- 缺陷：DEF-20260926-006（Fixing）；關聯 UR A.17
