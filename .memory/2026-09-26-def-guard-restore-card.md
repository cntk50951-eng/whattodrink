# 2026-09-26 守衛層被卡蓋：先收卡後彈層＋切後恢復（DEF-20260926-002）

## 情境

隱身模式點他人卡「乾杯」，`ModePrompt`（`fixed z-[999]`）彈在錨定卡後面，用戶要求：卡先消失→層居中→切公開／好友後原卡恢復續操作。

## 問題

守衛只彈層不收卡，且層級低於卡，流程斷在中間（切完模式還得重找那個人）。

## 原因

`card` 由 `selectedId` 派生、錨點每 render 按 pin 屏座標重算——恢復 `selectedId` 即原位重開，天然支持「收後恢復」，之前沒用上。

## 修正

- `handleCheers`／`handleInvite` 隱身分支：`setPendingCardId(id)`＋`setSelectedId(null)`＋彈層；`ModePrompt` 加可選 `onSwitched`（成功才調，失敗／取消不調）；DrinkMap 在回調里恢復卡；`closeGuard`／登出清 pending（取消不恢復，避免幽靈重開）。
- 共用方（榜／詳情／相機）僅加可選 prop，默認行為不變；打卡 403 路徑無卡，pending 恆 null。
- 三閘綠；純組件態流轉無新單測（testing.md：React 組件邏輯視情況，用戶瀏覽器覆蓋）。

## 關聯

- 涉及：`components/auth/ModePrompt.tsx`（可選 `onSwitched`）、`components/map/DrinkMap.tsx`（pending＋收卡＋恢復）
- 缺陷：DEF-20260926-002（Fixing）；新 UR A.19 好友感知引導（文檔化未實作，承 A.17）
