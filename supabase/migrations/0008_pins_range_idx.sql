-- UR A.13 地圖時間窗口：快貼 24h / 帖子 7d→90d
-- 時間判定一律 server side（now()），不信客戶端時鐘
-- 為 `GET /api/v1/map/pins?range` 的謂詞加速：
--   (kind='flash' AND expires_at > now()) OR (kind='post' AND created_at >= now()-range)
-- `created_at` 已有 checkins_created_idx，這裡補 expires_at 與複合

CREATE INDEX IF NOT EXISTS checkins_expires_idx ON checkins (expires_at);
CREATE INDEX IF NOT EXISTS checkins_kind_expires_idx ON checkins (kind, expires_at);
CREATE INDEX IF NOT EXISTS checkins_kind_created_idx ON checkins (kind, created_at DESC);
