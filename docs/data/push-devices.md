# 原生推送設備資料（UR D.11）

| 頁面／用途 | 類型 | 當前來源 | 表映射 |
|---|---|---|---|
| App 登入後設備登記／退出解除 | platform: ios 或 aos | APNs／FCM 客戶端，需登入才能寫 | devices.platform |
| 遠端通知送達目標 | push_token: string；iOS hex，AOS opaque FCM token | 平台SDK，私有，不回API／log | devices.push_token，與platform組成唯一鍵 |
| APNs環境選擇 | sandbox 或 production | iOS build環境；AOS欄位僅相容保留 | devices.environment |
| 發送語言／設備開關 | locale: string、enabled: boolean | App語言／權限同步 | devices.locale、devices.enabled |
| 版本／活躍／綁定帳號 | app_version、last_seen_at、user_id | 登記API與已驗證登入者 | 沿devices既有欄位 |
| 後端FCM認證 | 服務帳戶JSON | Vercel FIREBASE_SERVICE_ACCOUNT_JSON Secret | 不進業務庫／不進客戶端 |
| 事件結果與去重 | kind／dedupe_key／status | 既有發送器 | push_log，無token／正文 |

不新增資料表或RLS；設備owner、re-bind、10台上限沿舊實作。通道分流不改badge算法。業務通知點擊仍按payload t及對應ID由App處理；真實送達需AOS後續權限、註冊與導航接線。

AOS FCM data 使用 from_user_id（FCM 保留 from），iOS 仍使用原 from；事件欄位與ID見OpenAPI的x-native-push-payloads。不能將APNs整包直接塞入FCM data。


## D.12 AOS業務推送（待用戶執行0077）
| 用途 | 類型 | 當前來源 | 表映射 |
|---|---|---|---|
| 待發事件、重試與租約 | UUID、recipient、kind、source ID、安全導航ID、expires、status、attempts、lease token | notifications/messages/drink_invites trigger | native_push_outbox（RLS，僅service_role） |
| 每設備已送結果 | event_id/device_id/status/finished_at，唯一事件＋設備 | dispatcher成功／dead結果 | native_push_deliveries（RLS，僅service_role） |
| 新加入、投訴回執／待回應 | 既有notification格式 | joins／complaints INSERT trigger | notifications（kind新增member_joined；ack/response啟用實際來源） |
| 定時酒局提醒、出席確認 | party ID/user ID/kind及截止 | produce_native_push_reminders（cron及lazy GET共用） | notifications＋party_reminders同transaction |
| Android顯示與導航 | 全字串t/title/body/recipient_id/event_id/expires_at/collapse_id及可選ID | FCM data-only、App驗帳號／過期／去重 | 不存聊天正文或證據；OpenAPI1.67 |
| 排程憑證 | URL與Bearer Secret | Supabase Vault UI＋Vercel CRON_SECRET | Vault；不進App或業務表 |

新事件只發AOS，iOS舊APNs不變。legacy三family的Android metadata由真實來源row ID產生，但仍沿after投遞；不宣稱已持久化。SQL執行／部署／真機驗證狀態見FCM_SETUP.md。

- D.12配置修正：推送認證優先讀PUSH_DISPATCH_SECRET，未設定才相容CRON_SECRET；Supabase Vault仍叫push_dispatch_secret。專用值配置後拒絕舊共用值，空／短值拒絕；無新增業務資料或表。
