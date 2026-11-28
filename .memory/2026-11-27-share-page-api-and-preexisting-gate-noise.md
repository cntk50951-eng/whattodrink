# 2026-11-27 分享打卡分頁接口（UR E.32）與兩個既有噪音

- 情境：新增 `GET /checkins/mine/share`（新到舊 keyset、`scope=shareable|blocked`、`q`）。
- 做法：游標用資料行 `created_at` 原字串（保微秒）；排序比較另拆微秒，不能只靠 `Date.parse`；主表＋歸檔合併時先按原始行切頁再去重，一頁可能少於 limit，客戶端只看 `next_cursor`。
- 噪音一：`lib/barBlackjackStore.test.ts`「開局…接回」全量跑時失敗 1 條（1621 條中）。原因未確認（讀碼推測和隨機發牌有關）；該檔最後改動 11-09，本次未碰。
- 噪音二：`docs/api-openapi.yaml` 在 HEAD 就有一處嚴格 YAML 解析錯誤（`next_reset_at` 的 description 含冒號），系統 ruby 解析失敗；改契約後要和 HEAD 比對，不要只看能否解析。
- 工具：一條命令裡混「循環重跑測試」和 `npx -y …@latest` 臨時下載會被權限檢查擋下；測試失敗就讀日誌定位，不要靠重跑。
