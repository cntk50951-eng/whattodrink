-- UR A.21 好友實時追踪：live 經緯度（可空；鮮度沿 `last_seen_at` 5min 窗，不另加時間列）。
-- 隱身不寫（應用層雙保險：前端不發＋`POST /api/v1/presence` 拒 stealth），stealth 行此二列永 NULL。
-- 本文件只加列；RLS 沿既有 users 自讀寫，位置可見性由 `GET /api/v1/friends/live` server 端過濾（見 route 註）。
ALTER TABLE users ADD COLUMN IF NOT EXISTS live_lat double precision;
ALTER TABLE users ADD COLUMN IF NOT EXISTS live_lng double precision;
