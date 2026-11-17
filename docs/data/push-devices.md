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
