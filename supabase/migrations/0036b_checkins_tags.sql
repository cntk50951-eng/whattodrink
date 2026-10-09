-- UR E.28-2/4：checkins.tags（打卡标签 text[]，taxonomy key）。
-- Dashboard SQL Editor 单独贴跑；成功 "Success. No rows returned"。
-- 顺序：第 2 个跑（死锁即等一分钟重贴本条，不脏数据）。

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
