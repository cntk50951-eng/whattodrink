# 2026-09-26 UR A.19 引導浮層好友感知（checkin_id 變體）

## 情境

A.19 原文要 `targetUserId`，但 A.17 落地刻意沒暴露作者 id（隱私口徑）；調用方手裡只有 checkin id。用戶拍板最安全最乾淨。

## 問題

- `friends/check` 只認 `user_id`，調用方解不到作者。
- 引導層雙鈕無差別，對非好友切好友屬無效選項。

## 原因

隱私與便利的tradeoff：暴露 `authorId` 公開列最省事但永久多一列可追蹤 id；server 側解（行不可見即非好友）零新增暴露且語義自洽（看不見的行自然非好友）。

## 修正

- 端點加 `checkin_id`（與 `user_id` 互斥校驗）；`lib` 加 `parseFriendCheckParams`＋3 單測。
- `ModePrompt` 加 `targetCheckinId`：開層即查（microtask checking 態 fail-open 雙鈕，沿 set-state-in-effect 配方），非好友隱藏好友鈕＋註釋行；關層不重置（同 target 重開沿用 verdict，換 target 重查）。
- 地圖卡（checkin 動作 null／乾杯邀約 pendingCardId）／榜（guardTarget）／詳情（id）三處透傳；camera 不動。
- 雙刀接縫教訓：route 兩處 edit 致雙 `try`，lint parsing error 即捉；同文件多刀後必跑 lint（本次即捉，未流出）。
- 三閘：232→235綠／lint 0 error／build 32頁；文案 17×3 parity PASS。

## 關聯

- 涉及：`friends/check` route、`lib/friends.ts`、`ModePrompt.tsx`、三處透傳、openapi、三語
- 關聯 UR A.19 [WIP]；無 migration；A.17 隱私口徑保留
