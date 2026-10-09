-- UR E.28-1/4：users.preferences（口味偏好 jsonb）。
-- Dashboard SQL Editor 单独贴跑；成功 "Success. No rows returned"。
-- 顺序：第 1 个跑（四份：a→b→c→d，跑完再重贴 0026）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb;
