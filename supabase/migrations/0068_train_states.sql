-- UR H.4 尾班車（真聯機）。
-- Dashboard SQL Editor 贴上执行（可重放：IF NOT EXISTS）。成功标志："Success. No rows returned"，
-- Table Editor 见 train_states 空表。
-- 说明：
--   整局状态存一份 jsonb，**含隐藏倒数的真实截止时间与总长**（绝不下发）；
--   只有 service_role 能读写（RLS 全开零 policy＝默认全拒），客户端只拿 GET 按人裁剪后的视图
--   （量化的「热度」0–4，算不出剩余秒数）。
--   rev＝乐观锁：两人同时推进（一人答题、一人轮询触发爆）时只有一个写得进。
--   随 game_rooms 级联删除。game_rooms.game 本就是自由文本，新增 'last_train' 不需改表。

CREATE TABLE IF NOT EXISTS train_states (
  room_id uuid PRIMARY KEY REFERENCES game_rooms (id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  rev int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE train_states ENABLE ROW LEVEL SECURITY;
