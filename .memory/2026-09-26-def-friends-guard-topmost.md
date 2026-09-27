# 2026-09-26 好友模式守衛＋守衛層保頂（DEF-20260926-008）

## 情境

用戶要求：隱身／好友模式下非好友卡按鈕必須可見（只攔截不隱藏）；守衛層必須絕對最上（002 教訓）；好友模式＋非好友點乾杯／邀約也要攔（僅公開選項），切完恢復續操作。

## 問題

- A.19 只覆蓋隱身觸發，好友模式非好友直通無攔截。
- 守衛層 `z-[999]` 且困於各父 stacking context（榜容器 z-1000 內），多層同屏時不保頂。

## 原因

- 攔截只攔了 stealth，friends 分支缺失（A.19 範圍延伸，合入本 UR 不另開）。
- fixed＋z-index 逃不出父 stacking context，必須 portal 到 body 才能真保頂。

## 修正

- `ModePrompt` 走 `createPortal(document.body)`＋`z-[1100]`（壓過卡／榜 1000、chooser 998；`!open` 即 null 不碰 document，SSR 安全）。
- `handleCheers／handleInvite` 拆 guard＋proceed；friends 分支先調 `friends/check?checkin_id`：好友直過、非好友收卡彈層（A.19 僅公開鈕＋002 恢復鏈）、查失敗 fail-open 直過（真守衛在後端）。
- 附带修真 pin 邀約只認 MOCK 表（005 同類漏網，`proceedInvite` 加 api 回退；effect 定時接受側默認 accepted，沿 MOCK 劇本口徑）。
- 按鈕可見性：本就無隱藏邏輯（cheers 常顯、邀約僅跟在線態），本次零改動，屬確認保留。
- 三閘綠；用戶瀏覽器覆蓋（好友模式非好友乾杯全鏈＋層級）。

## 關聯

- 涉及：`ModePrompt.tsx`（portal＋z）、`DrinkMap.tsx`（guard／proceed 拆分）
- 缺陷：DEF-20260926-008（Fixing）；關聯 UR A.19
