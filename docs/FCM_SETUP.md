# AOS FCM 基礎通道（UR D.11）

## 已完成的配置
- 服務端套件：firebase-admin 14.5.1，Node22+；iOS仍由原APNs通道送達，不需改iOS App。
- Vercel後端環境變量：Name 為 FIREBASE_SERVICE_ACCOUNT_JSON，Type 為 Secret，Value 為整份服務帳戶JSON。用戶已確認配置；本輪未讀內容或驗證權限。
- 不使用NEXT_PUBLIC前綴，不將私鑰放App、public、Git或log。服務端從環境讀取，無需上傳JSON檔到網站目錄。
- 所有實作仍在本地工作樹，未提交／推送／部署；不要把本地build成功當成Vercel版本已更新。

## 設備契約
- POST／PATCH／DELETE /api/v1/devices，需使用App登入者的Bearer session。回應不包含token。
- platform=ios／web 保留既有hex64–200驗證；platform=aos 接opaque FCM registration token，1–4096字元，不含空白／控制字元。
- environment仍為sandbox|production，缺省production；只影響iOS APNs，FCM不使用APNs sandbox。測試與正式Firebase專案由後端憑證與App配置分隔。
- 既有user_id取自已驗證登入者，登記re-bind、10台上限、enabled／locale同步及登出解綁語義保留。無需新增DB表或migration。
- 本契約目前接FCM registration token；不要把Firebase Installation ID（FID）直接當token送入。未來如切換FID，先同步契約、發送SDK與AOS註冊流程。

## 事件與payload
- 本階段已有碰杯、好友請求／接受、遊戲邀請的Android分流；與APNs沿同一偏好、文案、限頻、badge及重試規則。
- Android：FCM notification 放標題／內容，data 值都是字串，t保持cheers／friend_request／friend_accepted／game_invite，來源人為 from_user_id，來源帖子checkin_id，遊戲room_id／code。
- iOS：aps／from／事件ID保持原樣。不能把FCM data保留字from原樣送入Android。
- 已明確失效的FCM註冊會清理；泛化invalid-argument可能是payload問題，不得因此刪除有效設備。

## 後續驗收順序
1. 先補AOS runtime通知權限、Messaging service／channels／小圖標、取得與刷新token、登入綁定／登出解除及重試、通知點擊導航。現有AOS SDK auto-init仍關閉，還不能收到業務推送。
2. 後端程式需經用戶另行授權commit／push／部署後才到Vercel；檢查Secret適用於目標環境並讓新deployment載入。保持原APNs配置、正式站開關及其他環境值。
3. 在允許testOnly端點的非生產環境，將本人設備註冊為aos，POST /api/v1/devices/test-push，body為 {"event":"cheers","platform":"aos"}。沿原有開關，production維持不開test端點；省略platform仍是ios相容路徑。
4. 對照API的sent／devices、供應商安全錯誤碼與真機鎖屏／背景／冷啟動／點擊。供應商接受不等於用戶看見，分別記錄。不要在聊天或issue貼session、token、私鑰或完整JSON。
5. 聊天、約酒、酒局／出席／投訴／誠信等尚無遠端事件掛點，依兩端memory清單逐項設計及實作，不以此基礎通道代表22項全完成。

## 本輪本機驗證
- build 138頁；126測試檔／1285項全綠；lint 0 errors／12既有warnings；iOS APNs函數及sandbox分流有回歸。
- 未呼叫真實FCM／APNs，未裝機、未部署，UR保持WIP。
- 契約：docs/api-openapi.yaml 1.66.0（含 x-native-push-payloads）；資料：docs/data/push-devices.md；交接：.memory/2026-11-16-aos-fcm-backend.md。

## 官方依據
- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
- https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type
- https://firebase.google.com/docs/cloud-messaging/ios/get-started
