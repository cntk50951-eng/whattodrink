# Android 推送覆蓋與驗收現況（2026-11-18）

此表取代「send.ts 沒有函數＝後端未做」的舊推論。基準 web 6508ad2 加本輪 DEF-20261118-001 修正、Android當前工作樹；iOS不屬本輪實作。**22情境／21種 wire kind；有來源及接線不等於22項真機驗收完成。**

## 兩條現行發送路徑

- L：業務 API → `lib/push/send.ts` → `native.ts` → `fcm.ts`。三個函數、四種 kind（好友request/accepted分開），after初次＋最多兩次重試；未有持久outbox補發。
- Q：API資料寫入 → `supabase/migrations/0077_native_push_outbox.sql` trigger → `native_push_outbox` → cron → `lib/push/outbox.ts:dispatchNativePush` → FCM。消息、邀請及14種notification有真producer；每分鐘cron負責首次派發、重試、時間來源，並非僅兜底。
- Android：`core/push/PushModels.kt` 解析21種 kind；`PushCoordinator`處理owner／授權／expiry／receipts；`MapHomeScreen`＋各功能頁重取資料後導航。FCM來源人為 `from_user_id`，iOS原APNs的 `from` 不變。

## iOS 現況（2026-11-24 起）

- 上表是 **Android 22 情境**。iOS 走直接 APNs（不經 FCM），現有來源：`cheers`、`friend_request`、`friend_accepted`、`game_invite`（L 路徑），以及 `party_cancelled`／`party_completed`／`invite_cancelled`／`invite_completed`（`sendPartyNoticePush`，其中 `party_cancelled` 帶 `iosOnly` 避免 Android 重複）。
- **Q 路徑 outbox 對 iOS 開放的 kind 由 `lib/push/outbox.ts` 的 `IOS_OUTBOX_KINDS` 決定，目前是 `chat`（A03、A04）、`invite`／`invite_reply`（A05、A06）、`member_joined`／`member_left`／`member_left_late`／`reminder_1h`／`attendance_confirm`（A07、A09～A12）**：iOS 設備按其登記的 `environment`（sandbox／production）選 APNs host；鎖屏文案同 Android（只有暱稱，不含訊息內容）；`aps.thread-id` 按會話分組。好友／陌生人偏好、封鎖、靜音、已讀水位、隱身模式沿用 `eventStillEligible`。
- **往白名單加 kind 前必查**：該 kind 在 iOS 有沒有直接發送來源（例如 `party_cancelled`、`invite_*` 已有 `sendPartyNoticePush`）。有就先關掉直接發送，否則收件人會收到兩條。
- **尚未對 iOS 開放**：`complaint_*`、`trust_changed`、`game_join_request`／`game_join_result`／`game_kicked`（iOS 還沒有這幾種的點擊路由，要和 iOS 路由一起加）；`party_cancelled` 等 4 種有直接來源，永遠不能放進白名單。
- 延遲：outbox 由每分鐘 cron 派發，iOS 聊天推送比 L 路徑（碰杯／好友申請）多 0–60 秒。
- iOS 壞 token（`BadDeviceToken`／`Unregistered`／`DeviceTokenNotForTopic`）：outbox 把設備行設為 `enabled=false`（與 L 路徑直接刪行不同）；iOS 端只在 token／環境／版本／語言變化或超過 24 小時才重新上報。
- 未驗證：正式環境 AOS→iOS 聊天推送的真機送達（單測只證明路由與去重邏輯）。

## 逐項來源、偏好與點擊目的地

下表「已接」只表示現行源碼有完整路徑。**每列真機送達／點擊仍待驗**。路徑相對web；Android目的頁相對AOS。

| 項目 | wire kind／偏好 | 實際producer → 路徑 | Android目的頁 |
|---|---|---|---|
| A01 好友申請 | friend_request／friends | friends POST新建或stale復活 → sendFriendPush(request)，L | 好友請求展開並定位來源人 |
| A02 接受好友 | friend_accepted／friends | friends/requests/[id]接受；friends POST雙向pending自動接受 → sendFriendPush(accepted)，L | 好友頁定位新好友 |
| A03 好友私信 | chat／chat | conversations/[id]/messages INSERT → enqueue_native_message，Q；文字／圖片／語音／帖子／位置／酒局卡共用 | 指定conversation |
| A04 陌生人私信 | chat／stranger_chat預設關 | 同A03，派發時查當前好友關係及模式／封鎖／mute／讀水位 | 指定陌生會話 |
| A05 私人約酒 | invite／invites或stranger_invites預設關 | invites POST → drink_invites INSERT sent → enqueue_native_invite，Q | 約局›我的›指定邀請 |
| A06 約酒回覆 | invite_reply／invite_replies | invites/[id] sent→accepted/declined UPDATE trigger，Q | 同一邀請最新狀態 |
| A07 酒局入席 | member_joined／party | parties/[id]/joins INSERT → native_join_notice → notifications → enqueue_native_notice，Q | 酒局詳情／成員 |
| A08 撤局 | party_cancelled／party | parties/[id]取消，寫notification → Q | 已取消酒局 |
| A09 開局前離席 | member_left／party | parties/[id]/joins DELETE既有通知寫入 → Q | 酒局詳情 |
| A10 臨時離席 | member_left_late／party | 同A09，按既有臨時退出規則 → Q | 酒局詳情 |
| A11 開局前1h | reminder_1h／party | produce_native_push_reminders，open局host＋當前joins、唯一索引去重 → Q | 酒局詳情／導航 |
| A12 出席確認 | attendance_confirm／party | 同producer，結束後24h窗口、無須先開頁 → Q | 出席確認入口 |
| A13 被投訴 | complaint_filed／party | parties/[id]/complaints寫notification → Q | 指定案件 |
| A14 需要申辯 | complaint_response_needed／party | complaints INSERT awaiting_response且有未到期限 → native_complaint_notice → Q | 指定案件／申辯 |
| A15 受理回執 | complaint_ack／party | complaints INSERT → native_complaint_notice給filer → Q | 自己提交的指定案件 |
| A16 處理結果 | complaint_result／party | lib/complaintDecision.ts實際寫notification → Q | 指定案件結果 |
| A17 誠信變動 | trust_changed／party | lib/trust/ledger.ts按原門檻寫notification → Q | 本人誠信頁 |
| A18 遊戲邀請 | game_invite／game_invites | games/rooms/[id]/invites成功後sendGameInvitePush，L | 重查對應邀請／房間，不自動接受 |
| A19 入座申請 | game_join_request／game_invites | games/rooms/[id]/join寫notification → Q；pending且5min內 | 房主指定房間／申請 |
| A20 入座結果 | game_join_result／game_invites | games/rooms/[id]/requests/[rid]批准／拒絕寫notification → Q | 批准且仍為成員開房；拒絕只顯示結果 |
| A21 被移出 | game_kicked／game_invites | games/rooms/[id]/kick寫notification → Q；踢人兼封鎖亦保留系統結果 | 顯示移出結果，不重新加入 |
| A22 碰杯／碰返 | cheers／cheers | cheers POST兩種輸入共同成功尾段sendCheersPush，L；沿限頻 | 碰杯頁／來源帖子 |

A13/A14同一非安全投訴在response-needed已存在時合併一次鎖屏提醒，並非漏接。party=false同時關酒局／投訴／誠信；game_invites=false關遊戲類。這是現有9鍵偏好契約。

## 本輪找到並修正的真缺口

1. stale好友行重發請求更新既有created_at；Android event_id加入請求世代，避免錯誤過期／舊receipt吃掉新申請。iOS payload保持。
2. member_joined按酒局結束時間檢查，允許合法開局後加入；退出類仍只在開局前提醒。
3. 遊戲批准共用結果寫入：已有active玩家或同用戶23505競態也能產生結果；不同玩家席位衝突不假批准，已決定重試不重複。
4. game_kicked是系統狀態結果，踢人兼封鎖不再被全域contact block抑制；仍查源notice／room／玩家kicked或left／偏好。
5. Android成功載入仍找不到指定邀請時提示失效；遊戲push身份採登入auth ID，不依賴較慢的/me。
6. Android通知採現有品牌全彩大圖＋原圖輪廓單色smallIcon、本機語言品牌名稱；前台保留根層橫幅及低干擾通知欄紀錄。

## 已驗證與尚未完成

- 用戶已核對0077物件、Vault五欄true、job6自動cron連續成功；request482 HTTP200但claimed/sent皆0。這證明配置／空批次呼叫，未證明provider接受或裝置顯示。
- 正式DB的5個trigger是否仍啟用可用 `supabase/push-coverage-readiness.sql` 唯讀複核；不需重建job或重跑migration。SQL檔在repo不是正式DB狀態的證據。
- L仍有限重試；部分Q業務→notification寫入不在同一DB交易，notice本身寫入失敗不會由outbox自動重建。不能宣稱無漏送保證／exactly-once。
- Q首次發送通常多等0–60秒及積壓／網路時間；已讀、mute、退出、撤回、過期、偏好及owner失效會抑制，不能把這些當無producer。
- 全22情境仍需雙帳號真機測前台、背景、鎖屏、冷啟動、偏好、切帳號及點擊。原重啟手機維持暫停；沒有由agent發真推送或讀私鑰。
- 帖子留言／讚、收回邀請提醒、背景附近好友、遊戲逐回合等屬未定義的擴充需求，並未包含在22核心承諾，也不能稱已完成。
