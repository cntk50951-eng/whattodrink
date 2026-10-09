-- UR E.28 口味偏好＋打卡标签＋推测缓存。
-- 可重放：IF NOT EXISTS 全套。Dashboard SQL Editor 贴跑，
-- 成功标志 "Success. No rows returned"。
-- 顺序：本文件先跑（加列），再重贴 0026（搬运函数引用 tags 列）。
-- 说明：
--   users.preferences jsonb（{favorites,likes,dislikes}，校验在路由层）；
--   checkins.tags text[]（打卡标签，E.28 交接 taxonomy key）；
--   checkins_archive.tags 同步（归档搬运 0026 同改，推测覆盖归档信号）；
--   user_taste_inference 缓存（读时懒算，无 cron；payload groups＋sample＋watermark）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE checkins_archive ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS user_taste_inference (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  sample_count int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  checkin_watermark timestamptz
);
-- 缓存只走 service-role（读写全服务端）；RLS 开且零 policy＝默认全拒。
ALTER TABLE user_taste_inference ENABLE ROW LEVEL SECURITY;
