# 2026-11-27 舉報審核結果推送（UR E.33，migration 0096）

- 情境：舉報類通知原本只寫站內；用戶定只把 `report_resolved` 推給舉報人（Android）。
- 做法：0096 整段重建 `enqueue_native_push`（從 0077 抽原文改兩處）；`eventStillEligible` 要在 `prefs.party` 判斷之前放行；`collapseId` 加 `report_id`，否則多宗結果互相覆蓋；不進 `IOS_OUTBOX_KINDS`。
- 未驗：SQL 沒在任何資料庫實跑（本機沒有 PGlite），只用 diff 核對；正式推送待 0096＋部署＋真機。
- 順序：0096 → 部署 web → 發新版 Android 包。
