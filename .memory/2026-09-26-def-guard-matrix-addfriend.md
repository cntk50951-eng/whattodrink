# 2026-09-26 守衛模式×關係矩陣＋最小加好友（DEF-20260926-009）

## 情境

用戶驗收 A.19 時報：好友模式點非好友乾杯，彈的是隱身文案，且全程無添加好友鈕。要求兩維檢查（viewer 模式×是否好友）決定按鈕，並給出四格期望，實現方式由我設計。

## 問題

- 文案寫死隱身，friends／public 觸發全錯版。
- 加好友流不存在（寫 RLS 全拒、無端點、無 UI）。

## 原因

- A.19 只做了關係感知，沒做模式感知（mode 未傳入層）。
- 好友關係只有讀沒有寫（V1 驗證行手插，產品無入口）。

## 修正

- ModePrompt 重寫為 `(mode, relation)` 矩陣：隱身（非好友加鈕／好友雙鈕）／好友（同前）／公開非好友（加鈕＋直接執行 ghost）；未知 fail-open；全空防禦回退雙切。10 新 key×3 parity PASS。
- `POST /friends` 最小邀請：`friend_id|checkin_id` 二選一、查重（接受→accepted／反向pending→雙翻／我方pending→冪等／無→插）、並發 23505 重試一次、`0010` 寫 policy（發起＋翻轉，身份鎖死防劫持）。
- 地圖卡：隱身瞬開層內自查；friends／public 先查（會話緩存）再分支；匿名沿舊直過。榜／詳情透傳 target＋mode＋add；camera 補 mode（build 捉到，lint 沒捉——tsc 蓋了 lint 盲區一例）。
- 三閘：235→237綠／lint 0 error／build 33頁。

## 教訓

- 新必填 prop 加完必跑 build（lint 不查 JSX prop 完備，tsc 才查）。
- RLS 寫 policy 的 WITH CHECK 必須同時鎖身份＋值域，否則等於開洞。

## 關聯

- 涉及：`ModePrompt.tsx` 重寫、`POST /friends`、`0010`、`useFriendRelation.ts`、地圖卡分支、榜／詳情／相機透傳、30 文案鍵、openapi
- 缺陷：DEF-20260926-009（Fixing）；關聯 UR A.19
