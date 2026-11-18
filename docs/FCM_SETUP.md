# Android FCM 配置與啟用（D.11／D.12）

2026-11-18現況：D.11／D.12及專用Secret修正已部署；用戶已驗0077物件、Vault與job6，request482 HTTP200空批次。22情境源碼及本輪邊界修正見PUSH_COVERAGE_MATRIX；有事件的FCM實送與真機驗收仍待完成。下方啟用步驟供新環境使用，現有正式環境不需重建。

## 應用與憑證

- Android專案在 `whattodrink_aos`，Firebase project `hidrink-0611`、package `hk.whattodrink.app`。Android配置只放其app/google-services.json（Git忽略），服務帳戶私鑰不進App。
- 後端API／FCM程式及下方SQL在 **whattodrink web repo**。firebase-admin14.5.1、Node22+；只從server Secret `FIREBASE_SERVICE_ACCOUNT_JSON`讀完整service-account JSON，無NEXT_PUBLIC前綴。不改SITE_LIVE、其他環境值或iOS App。
- iOS保留原直接APNs；D.12新事件先供AOS，現有四種APNs payload及sandbox／production相容。

## 契約與客戶端

- OpenAPI1.67.0：POST／PATCH／DELETE /api/v1/devices，登入Bearer、owner／rebind／10台上限／enabled／locale保持。ios/web仍hex64–200；aos opaque FCM registration token1–4096、無空白／控制字元，**不是FID或私鑰**。environment不決定FCM sandbox。
- FCM **data-only**：t/title/body/recipient_id/event_id/expires_at(epoch-ms)/collapse_id等皆字串；來源人from_user_id，App先驗帳號與期限再顯示。iOS的from／aps不變。
- AOS-0.138已接runtime權限、七類channels、加密token及receipt／pending route、登入與登出同步、前台橫幅、精準跳轉、頭像→通知設定及九類偏好；原始SDK配置「尚未接入」是歷史紀錄。
- 手機恢復後按AOS `docs/PUSH_TEST_PLAN.md`逐項驗。非生產testOnly環境可用本人Bearer POST /api/v1/devices/test-push `{"event":"cheers","platform":"aos"}`；省略platform仍ios，production不開測試端點。

## 本機驗證

- web build139頁；128檔／1304tests綠；lint0errors／12既有warnings。iOS分流與原格式有回歸，未發真FCM／APNs。
- 0077在臨時PGlite真PostgreSQL跑apply／replay、實際trigger、reminder／attendance去重、claim不重疊／lease重領、RPC權限與expiry皆過；沒有連正式DB。重跑腳本見scripts/verify-push-outbox-sql.mjs，PGlite只供本機測試、不加runtime依賴。
- Android assemble及747tests綠，lint仍有25個既有Compose資源讀取錯誤；沒有真機親驗，不將UR打✓。手機重啟由用戶暫停裝機，未歸因App。

## D.12：完整AOS業務推送與持久outbox（待Dashboard啟用）

**2026-11-17配置驗證完成：Vault五欄全true、request482 HTTP200且空批次正常、自動job6 UTC08:22–08:24連續三次succeeded。DEF-20261116-003配置缺陷Verified；無需額外建表或重建cron。FCM真事件／真機實送仍未驗，D.12保持WIP。** 新業務事件僅發AOS；iOS現有APNs四種payload與發送掛點保持不變，其他iOS事件等客戶端路由準備好再開。沒有增加付費Vercel每分鐘cron，也不改現有兩個每日job或SITE_LIVE。

### 用戶操作順序（SQL只由用戶在Supabase Dashboard執行）
1. 檢視並執行 `supabase/migrations/0077_native_push_outbox.sql`。此檔整體transaction，建立outbox／delivery、只供service_role的claim RPC、來源trigger和排程producer。沒有重播舊消息；啟用後的新INSERT／有效狀態轉換才入列。若已有重複提醒，partial unique index會令migration整體回滾，先查明重複資料；不要為通過migration盲刪通知。
2. 後端D.12按本輪既有授權commit／push並部署（最終SHA見memory／交付），確認Vercel已有FIREBASE_SERVICE_ACCOUNT_JSON與至少16字元PUSH_DISPATCH_SECRET（建議32個隨機字元，Production）。新值用於推送，不必讀回或輪替共用CRON_SECRET；新增／修改環境值後需redeploy生效。未設定專用值時相容CRON_SECRET；明確設空／短值則拒絕，不回退。
3. 在Supabase Extensions啟用pg_cron、pg_net與Vault。在**Vault UI**建立 `push_dispatch_url`（Production HTTPS `/api/internal/push-dispatch`完整網址）和 `push_dispatch_secret`（與Vercel PUSH_DISPATCH_SECRET相同）。不把真實Secret寫進repo或分享截圖。
4. 檢視並執行 `supabase/push-dispatch-cron.sql`。它只替換名為native-push-dispatch的job，每分鐘HTTP POST喚醒後端。從Vault取Bearer，不傳service_role key。移除舊的**酒局1小時提醒**重複cron（先確認job SQL，勿刪其他job）；新producer本身已生成該提醒。
5. 請用戶真機測試以下22項、拒絕權限、鎖屏／背景／冷啟動、換帳號／登出、通知點擊、靜音／屏蔽／已讀、過期房間與斷網重試。SQL migration和mock測試不代表真機送達驗收。

若readiness的URL三欄false而Secret兩欄true，可由用戶執行 `supabase/push-dispatch-set-url.sql` 修正具名公開URL；不改密鑰或job。執行後再驗五欄、cron及HTTP。

完整Vault條件可用只讀 `supabase/push-dispatch-readiness.sql` 檢查五欄；只有Secret兩欄true不足以判定URL可用。URL格式必須含https及完整path，無尾斜線／空白／引號。

### 舊Secret無法讀回時

專用Secret支援已於3f0929f部署Production成功（2026-11-16）；新增／修改Vercel環境值後仍需Redeploy載入該值。

Vercel Secret儲存後不可讀回，無需取回舊CRON_SECRET。新增Production Secret **PUSH_DISPATCH_SECRET**，在本機密碼管理器保留，再將同值填入Supabase Vault **push_dispatch_secret**。Vault URL仍為push_dispatch_url，不需重跑0077或重建job6。部署新環境後重查Vault四項、cron執行及HTTP結果。新值只用於Supabase→web認證，不放App，也不使用Firebase service-account JSON替代。

### 22項來源與分工
| 清單 | 來源 | 狀態／路由資料 |
|---|---|---|
| A01／A02 好友請求與接受 | 保留sendFriendPush原after掛點；補POST反向pending自動接受AOS-only掛點 | Android增加recipient_id、穩定來源row事件ID、到期；iOS不變 |
| A03／A04 好友／陌生人私信（包括全部附件） | messages INSERT trigger | t=chat，conversation_id；發送前重新查成員、水位、mute、封鎖、模式和chat／stranger_chat偏好 |
| A05 新私人約酒 | drink_invites INSERT sent | t=invite，invite_id；好友invites／陌生stranger_invites（預設關） |
| A06 私人約酒回應 | sent→accepted／declined UPDATE trigger | t=invite_reply，invite_id／decision；invite_replies；婉拒推送是本次清單明確要求的行為更新 |
| A07 新成員加入 | joins INSERT trigger生成member_joined通知 | 只有真正新增，幂等23505重試不生成；通知發起人 |
| A08／A09／A10 撤局／退出／臨近退出 | notifications INSERT trigger | party_cancelled／member_left／member_left_late；維持原有收件人與開局前／屏蔽政策 |
| A11 開局前1小時 | 每分鐘producer生成reminder_1h | 發起人＋當時仍在joins者，通知與去重reservation同transaction；遲掃可補至開局前，開始即過期 |
| A12 結束確認出席 | 每分鐘producer生成attendance_confirm | 結束後24h窗口，host＋仍在joins者；原lazy GET改調同一producer（0077執行前僅RPC缺失才回退舊寫法），沒有兩套競態寫入 |
| A13 被投訴 | 原complaint_filed通知 | 安全案件仍通知；非安全與response-needed合併成一次系統提醒 |
| A14 需要申辯 | complaints INSERT awaiting_response trigger | complaint_response_needed；依真實response_due_at，已回應／過期則不發 |
| A15 投訴回執 | complaints INSERT trigger | complaint_ack→filer |
| A16／A17 結果與誠信 | 原complaint_result／trust_changed通知 | 維持現有結果、收件人與誠信門檻；鎖屏僅通用提示 |
| A18 遊戲邀請 | 保留sendGameInvitePush原after掛點 | 加Android事件識別／帳號／房間到期；iOS不變 |
| A19／A20／A21 入座申請／結果／踢出 | 原game_join_request／game_join_result／game_kicked通知 | room_id，approved／rejected；申請5分鐘有效，重查房間和申請／玩家狀態 |
| A22 碰杯與回敬 | 保留sendCheersPush原after掛點 | 繼承原限頻／合併／來源帖；Android穩定事件ID與帳號防串 |

### 目前cron負責首次投遞及重試
+
+messages／drink_invites／notifications的trigger只入outbox，目前沒有事件完成後立即喚醒dispatcher。因此每分鐘native-push-dispatch同時負責新事件**首次發送**、可重試事件，以及產生1h／結束出席提醒；不是純補發兜底。正常可能等待約0–60秒，排隊／網路／供應商會更久，聊天不能宣稱已即時派發。既有好友／碰杯／遊戲邀請三family仍API after直接嘗試，不由此cron統一補發。
+
+建立腳本已提交，agent未執行正式Supabase SQL。核實job可在SQL Editor執行：
+```sql
+SELECT jobid, jobname, schedule, active
+FROM cron.job
+WHERE jobname = 'native-push-dispatch';
+```
+未啟用pg_cron時cron schema尚不存在；不以腳本在repo等同job已建立。
+
+### 重試、安全與限制
- claim RPC用FOR UPDATE SKIP LOCKED、3分鐘lease與隨機lease_token；每批16事件、4個事件worker、每事件最多10設備，45秒工作預算、單次provider等待上限15秒。超時／資料庫錯誤fail closed、不聯繫provider，留待重試；最多8次、退避30秒至1小時，過期／耗盡進dead。
- 每事件每設備成功記native_push_deliveries，部分失敗只重試未成功設備；FCM明確dead registration停用對應owner/token仍一致的設備。FCM暫時失敗或invalid-argument不刪有效token。
- 傳送前再讀owner／enabled／token、使用者偏好、source狀態、讀水位、封鎖與mute。帳號在最後一個網路瞬間仍可能切換，因此Android仍必須核對recipient_id與當前帳號。data-only避免系統直接顯示舊帳號通知。
- 至少一次送達：provider接受後、DB記成功前進程可能中斷，provider timeout也可能實際已接受；不能承諾網路exactly-once。相同event_id保持不變，App以event_id去重，collapse_id聚合；去重不能只靠新UUID。
- 舊三個send函數仍是既有after模式（未遷至持久outbox），保留其既有行為與限制。不得將新outbox的持久保證套用到好友／碰杯／遊戲邀請三個舊family。
- party偏好統管酒局／投訴／誠信，game_invites偏好統管遊戲通知；未私創新push_prefs鍵。陌生人預設關。聊天正文、座標、圖片、證據、案件自由文本不進push。
- 沒有Google Play services的機型不保證FCM可達；若需要中國大陸／無GMS設備覆蓋，另規劃廠商通道，不以常駐輪詢代替系統push。供應商接受不等於用戶已看見。

### 觀測與排障（只查安全欄位）
```sql
SELECT status,count(*),min(created_at) AS oldest FROM public.native_push_outbox GROUP BY status;
SELECT id,kind,status,attempts,last_error,available_at,lease_until FROM public.native_push_outbox
 WHERE status IN ('pending','processing','dead') ORDER BY created_at LIMIT 50;
SELECT status,count(*) FROM public.native_push_deliveries GROUP BY status;
SELECT jobid,jobname,active FROM cron.job WHERE jobname='native-push-dispatch';
SELECT jobid,status,start_time,end_time,return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
SELECT id,status_code,timed_out,error_msg FROM net._http_response ORDER BY id DESC LIMIT 10;
```
API只回計數，503不輸出token／Secret／SDK原始錯誤；native_push_outbox last_error亦只有安全代碼。不要查閱／複製Vault decrypted_secret到log。臨時停發可由Dashboard取消native-push-dispatch或將devices.enabled關閉；重啟後source會重新驗證，過期不補發。

D.12新表是內部投遞狀態，不可由App直接讀寫。後續保留期／清理policy尚未自動排程，觀測表量後制定；不要無限保留debug資料或刪除仍可重試事件。參考[Supabase排程與Vault](https://supabase.com/docs/guides/functions/schedule-functions)、[PostgreSQL鎖定與SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html)。

pg_net官方提醒：帶Bearer的HTTP request在發送前會短暫留在net.http_request_queue，具有資料庫登入權的人可能讀到；限制DB登入／schema權限，不截圖queue headers，Vault不是對高權限DB使用者隱藏傳輸header的保證。

## 2026-11-18覆蓋復核

22情境的實際來源、兩條發送路徑、偏好與未驗範圍見 [PUSH_COVERAGE_MATRIX.md](PUSH_COVERAGE_MATRIX.md)。本輪只改API／dispatcher，無新migration，既有0077與job6不需重跑；需要確認正式trigger啟用可執行 `supabase/push-coverage-readiness.sql`（唯讀、不發送）。
