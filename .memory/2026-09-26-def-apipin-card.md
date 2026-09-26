# 2026-09-26 真數據pin點不開卡：開卡認全源（DEF-20260926-005）

## 情境

A.13 真數據接入後 pin 層走 apiPins，但開卡 `card` 派生只查 `MOCK_CHECKINS`；好友模式真 pin 點了無卡（mock pin 正常）。

## 問題

數據源一切換，消費側（開卡）沒跟著切——典型的換源漏側（A.13 只換了渲染層，交互層忘在 mock 表上）。

## 原因

`renderOthersPins` 內聯了一份 api→Checkin 映射，開卡派生是另一份 mock-only 查詢，兩處映射分叉且後者無 api 分支。

## 修正

- 抽模塊函數 `apiPinToCheckin(p, nowMs)`，pin 層與開卡共用同一映射；開卡認 `MOCK → apiPins` 順序（mock 優先，id 空間不重疊故無衝突）；`focusAt`／錨點跟 card 走，自動恢復。
- 教訓：以後換數據源，渲染＋交互＋派生三側同單檢查（checklist：誰讀舊表？）。
- 三閘綠；用戶瀏覽器覆蓋（點真 pin 開卡＋乾杯）。

## 關聯

- 涉及：`components/map/DrinkMap.tsx`（`apiPinToCheckin`＋card 派生）
- 缺陷：DEF-20260926-005（Fixing）；關聯 UR A.17
