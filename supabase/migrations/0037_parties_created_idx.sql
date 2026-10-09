-- UR E.29 地图变化计数：parties 按 created_at 窗扫（缺省看板＋since）。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。

CREATE INDEX IF NOT EXISTS parties_created_idx
  ON parties (created_at DESC);
