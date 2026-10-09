-- UR E.27 主页统计：checkins 按 user 扫 created_at（夜数／地点；归档表已有 user 索引，主表补一个）。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。

CREATE INDEX IF NOT EXISTS checkins_user_created_idx
  ON checkins (user_id, created_at DESC);
