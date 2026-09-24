# 2026-09-24 打卡雙類型（快貼/帖子）

## 情境
用戶提出六大前端需求，首步從打卡雙類型開始：快貼 24h 消失、帖子永久，地圖 24h/7d/90d 與三模式（隱身/好友/公開）皆依此分流；API 需登入，未登入點酒應引導登入。

## 數據
- `0007_checkins_kind_visibility.sql`：`checkins.kind flash|post`（default flash）、`expires_at`（flash +24h，post null）、`visibility` 擴 `friends`、`users.mode stealth|friends|public` 預設 `public`（本次確認）、`friendships` 樁位
- `WantRecord` 擴 `kind/visibility/expiresAt/id`，`parseWantRecord` 透傳

## 請求體
- `POST /api/v1/checkins {beer_id, lat, lng, place_name?, kind: flash|post}`，`visibility/expires_at` 由後端按 `users.mode` 派生（stealth 403），缺 kind 兼容 flash，`GET /mine` 回 `kind/visibility/expires_at`

## UI
- `DrinkMap.handleBatchWant` 改點格不直落釘，先彈雙鈕 chooser（`Clock` 快貼 24h / `MapPin` 帖子永久，doodle 卡+硬陰影，emoji 頭）；`handleKindChoose` 再 `dropWantWithKind`，未登入→ `A.11` 登入浮層，隱身→ 403 隱身提示浮層（引導切換，T&C 下一 UR），已登入→ `POST {kind}`

## 兼容
- `42703` 未遷移回退舊插入/舊列（private），本地 `npm test 201` 綠，線上待用戶在 Dashboard 執行 `0007` SQL（見 `supabase/migrations/0007_*.sql`）

## 關聯
- 涉及：`supabase/migrations/0007`, `lib/api/checkins.ts`, `app/api/v1/checkins/**`, `components/map/DrinkMap.tsx:603,1298,1384,2781`, `docs/api-openapi.yaml`
- 測試：`lib/api/checkins.test.ts` 14/26 201
