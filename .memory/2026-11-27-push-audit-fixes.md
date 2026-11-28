# 2026-11-27 推送檢查後的四項修復（DEF-20261127-037～040）

- 模組／關鍵詞：`lib/push`／撤回、角標、APNs http2、FCM collapseKey。
- 撤回是軟刪：凡是讀 `messages` 做推送或計未讀的地方都要看 `deleted_at`；未讀口徑以列表 RPC（0079）為準，含會話 `expires_at`。覆蓋矩陣寫「撤回會抑制」但聊天其實沒做，文檔結論要回代碼核對。
- Node http2：session 沒掛 `error` 監聽＝連線失敗直接退出行程（stream 上有監聽也沒用）；收過 GOAWAY 且有在途請求時 `closed=true`、`destroyed=false`，復用判斷兩個都要看。可用回環位址寫真測試。
- FCM：設了 `collapseKey` 就受可摺疊限流（每台裝置 20 條突發、3 分鐘補 1 條），聊天不要設。
- 上線前提：正式庫要有 `messages.deleted_at`，否則派發查詢 42703、聊天推送重試八次後作廢。
- 未修（只報告）：過期但仍是 `sent` 的邀約算進角標；outbox 每分鐘只領 16 件（等正式數據）。
