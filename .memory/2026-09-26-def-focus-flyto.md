# 2026-09-26 點pin拉全港：退役遠距雙人同框（DEF-20260926-004）

## 情境

好友模式只看好友下點好友 pin，地圖拉遠回全港。用戶在深圳、好友在 HK（約 30km）。

## 問題

`handleFocusPerson` 遠距分支 `fitBounds(自己, 對方)`（UR1.6 雙人同框）：跨城即拉到 z9 左右，體驗差是結構性的，非偶發。

## 原因

點 pin 的意圖是「看這個人」，同框回答的是「我們有多遠」——兩個問題。距離答案卡片距離行已實時給出，同框屬多餘且有害的默認。行業三家（Snap Map 點 Bitmoji 看位置＋底部卡、Google 地圖點頭像出底部詳情、Apple Find My 列表點名）全是只飛對方，無一家拉全框。

## 修正

- `handleFocusPerson` 收斂為一律 `flyTo(對方, max(zoom,14))`＋開卡（近距／無定位沿舊，行為統一）；刪 `MIN_FOCUS_SEPARATION_M`＋`FOCUS_CARD_CLEAR_PX`（零引用，lint 會報）；搖一搖聚焦同函數一併受益。
- 同框能力非破壞式退役：日後要加，做卡片內「同框」鈕另開 UR。
- UR1.6 凍結條目已回寫改動記錄；三閘綠；用戶瀏覽器覆蓋（深圳點 HK pin）。

## 關聯

- 涉及：`components/map/DrinkMap.tsx`（`handleFocusPerson`）
- 缺陷：DEF-20260926-004（Fixing）；關聯 UR A.17
