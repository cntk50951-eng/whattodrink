# 2026-11-27 酒局探索走 `view=explore` 分支（UR E.34，migration 0097）

- 情境：`GET /api/v1/parties` 默認回應被地圖、搖一搖、遇見、已安裝舊版依賴，不能改行為。
- 做法：新行為只在 `view=explore` 分支；`route.test.ts`（假資料庫）鎖住默認結果。vitest 沒有 `@/` 別名，要 `vi.mock` 指相對路徑。
- 未驗：keyset `or()` 配真實 `+00:00` 時間戳只在假資料庫跑過；0097 未執行。
- 順序：0097 → 部署 web → 發兩端新版。
