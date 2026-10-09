-- UR E.28-3/4：checkins_archive.tags（归档同步列，推测覆盖归档信号）。
-- Dashboard SQL Editor 单独贴跑；成功 "Success. No rows returned"。
-- 顺序：第 3 个跑（避开每日 04:00 HKT 搬运窗口前后十分钟）。

ALTER TABLE checkins_archive ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
