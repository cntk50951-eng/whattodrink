# 2026-11-16 / AOS FCM 基礎通道（UR D.11）

## 情境
- 用戶要求先修 AOS build、記 memory 給 teammate；AOS-0.137／DEF-20261116-003 已 build 成功（1m9s、40 tasks）。用戶已授權成功後增強 web API。
- 用戶確認 Vercel 已配置 FIREBASE_SERVICE_ACCOUNT_JSON Secret；本輪未讀其值、未讀 Downloads 服務帳戶私鑰，未修改 SITE_LIVE、未 commit／push／部署。
- 平台邊界：AOS 新增 FCM；iOS 保留直接 APNs（無 iOS Firebase SDK 遷移）。iOS 可選經 FCM 代發，但最後仍經 APNs，不能繞過 Apple 憑證。

## 問題／根因
- 舊 /devices 雖有 aos 枚舉，三種 mutation 都強制 APNs hex；send.ts 也只選 iOS，缺 APNs 配置時連 AOS 都會被全局跳過。
- FCM data 保留 from，不能原封不動搬 APNs payload；Next after callback 原本 void 丟棄發送 Promise，serverless 不會追蹤完整工作生命週期。

## 修正
- 契約先行 OpenAPI 1.66.0；lib/api/devices.ts 供 POST／PATCH／DELETE 共用，ios／web 保留64–200 hex；aos 接 opaque FCM registration token（1–4096 printable ASCII、不含空白）。既有owner／re-bind／enabled／locale／10台上限不變，無新表／migration。
- firebase-admin 14.5.1（Node22+）只在服務端使用；lib/push/fcm.ts 讀 Secret／named app 隔離憑證及輪替，安全錯誤碼不帶token或SDK原始message；native.ts 分流，缺一通道憑證不阻斷另一通道。
- send.ts 的碰杯、好友請求／接受、遊戲邀請增加 AOS；沿既有偏好／限頻／badge／重試，明確失效註冊才刪設備，泛化 invalid-argument 不刪。iOS 原APNs payload及環境不變。
- AOS FCM notification 放標題／body，data 保留 t／事件ID，from 改 from_user_id；過濾message_type／google.*／gcm.*，契約 x-native-push-payloads 已列。
- test-push 加 platform=ios|aos，省略仍ios；沿 testOnly／登入／本人設備，沒有啟用正式環境測試端點。五個 after 掛點改 async／await（含遊戲批次），仍在主回應後執行。
- docs/FCM_SETUP.md、docs/data/push-devices.md、資料索引、.env.example、PRODUCT_BACKLOG D.11／CHANGELOG 同步；舊intro／頁面及封站旗標未改。

## 驗證／教訓／接續
- 最終 npm run build：138頁；npm test -- --maxWorkers=2：126檔／1285 tests 全綠（新27項，含3種mutation owner／401、iOS sandbox相容、分流、payload、錯誤）；lint 0 errors／12既有warnings；tsc亦通過。
- 新SDK依賴的audit無新增套件advisory；全站既有漏洞未擅改。build既有metadataBase警告保持原狀。
- 新handler測試先遇Vitest無@別名：局部factory載入同一真實純函數，不擴改全域runner。PATCH原就寫updated_at，測試須連時間戳一起斷言，不改正式行為迎合錯誤測試。
- 尚未真實FCM／APNs送達、未核實Vercel權限及Secret值；SDK本地mock成功不是正式推送完成。AOS仍auto-init關閉，完整service／channels／runtime權限／註冊與登出／導航尚待接線。
- 下一步：按 docs/FCM_SETUP.md 先接 AOS 客戶端，使用 registration token（本契約未將FID當token發送）；部署需要另行commit／push授權，之後用測試環境／本人設備驗證。聊天／約酒／酒局等未有遠端事件的掛點仍依 iOS／AOS 各22項 checklist 逐項做，沒有宣稱全部推送已完成。

## 後續發佈授權與範圍
- 2026-11-16用戶明確授權D.11的web API commit／push並追蹤Vercel部署；與先前未獲授權的狀態區分。只提交本批shared API／FCM，其他intro WIP留在工作樹；AOS完整22項通知接入另進AOS-0.138／後端D.12。
