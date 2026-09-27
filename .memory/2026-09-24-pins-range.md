# 2026-09-24 地圖時間窗口 server side range

## 情境
UR A.13 地圖時間窗口：快貼 24h 後從地圖消失、帖子預設 7d、按鈕切 90d 看三個月。用戶確認參數叫 `range` 且時間判定必須 server side（不信客戶端時鐘）。

## 問題
- `GET /api/v1/map/pins` 原只有 BBOX+模糊，無時效過濾，快貼永久可見違背 24h 失效
- 前端無 7d/90d 切換入口，DB 未對 `expires_at` 建索引，`or` 謂詞可能走全表掃

## 原因
- 0007 已加 `kind flash|post` + `expires_at`，但 0008 索引與 `GET /map/pins` 的 `range` 參數未落地
- 前端仍走 MOCK，`renderOthersPins` 硬綁 `MOCK_CHECKINS`，未接真數據

## 修正
- `supabase/migrations/0008_pins_range_idx.sql` 加 `checkins_expires_idx`/`kind_expires_idx`/`kind_created_idx`
- `lib/api/pins.ts` 加 `PinsRange 7d|90d` + `PINS_RANGE_MS` + `parseRange` 併入 `parsePinsParams`（缺省 7d，非法 400），15 單測（+4）
- `docs/api-openapi.yaml` `GET /map/pins` 加 `range` enum 7d/90d default 7d
- `app/api/v1/map/pins/route.ts` server `now()` 算 `cutoffIso` → `orFilter and(kind.eq.flash,expires_at.gt.now),and(kind.eq.post,created_at.gte.cutoff)`，42703 未遷移回退 bbox-only
- `components/map/DrinkMap.tsx` 右上 pill `7d↔90d`（`wtd-pins-range` + `fetch bbox=HK&range`），`apiPins` 真數據優先（非空替 MOCK，空回退並顯「暫無數據」），`mapReady` 後重渲染簇
- `docs/data/home-map.md` 增第 4 節時間窗口兩行

## 關聯
- 涉及：`lib/api/pins.ts`, `app/api/v1/map/pins/route.ts`, `components/map/DrinkMap.tsx`, `docs/api-openapi.yaml`
- 測試：`lib/api/pins.test.ts` 15/205

## 教訓
- 時間窗口一律 server `now()`，前端 `Date.now()` 僅用於本地測試，不可作為可見性真源
