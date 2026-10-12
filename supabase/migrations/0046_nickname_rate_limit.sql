-- 改昵称频率限制（WEB_HANDOFF_PROFILE_EDIT_MODERATION）：每天最多改 3 次（HK 自然天）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：nickname_updated_at（上次改名时间）＋nickname_daily_count（当日已改次数）；
--   RLS 无需动（PATCH /me 读写已沿 0006 users self 策略；计数由路由判）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname_updated_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname_daily_count integer NOT NULL DEFAULT 0;
