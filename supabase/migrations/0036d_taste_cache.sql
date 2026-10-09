-- UR E.28-4/4：user_taste_inference 缓存表（读时懒算，无 cron）。
-- Dashboard SQL Editor 单独贴跑；成功 "Success. No rows returned"。
-- 顺序：第 4 个跑。RLS 开且零 policy＝默认全拒，只走 service-role。

CREATE TABLE IF NOT EXISTS user_taste_inference (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  sample_count int NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  checkin_watermark timestamptz
);
-- 缓存只走 service-role（读写全服务端）；RLS 开且零 policy＝默认全拒。
ALTER TABLE user_taste_inference ENABLE ROW LEVEL SECURITY;
