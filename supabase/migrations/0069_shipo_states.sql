-- 老实人·识破 shipo（真联机）。
-- Dashboard SQL Editor 贴上执行（可重放：IF NOT EXISTS）。成功标志："Success. No rows returned"，
-- Table Editor 见 shipo_states 空表。
-- 说明：
--   整局状态存一份 jsonb，**含每人身份（想想／老实人／瞎掰人）与题卡**；
--   只有 service_role 能读写（RLS 全开零 policy＝默认全拒），客户端只拿 GET 按人裁剪后的视图
--   （真相只在 peek 阶段给老实人；他人身份 result 之后才公开）。
--   rev＝乐观锁：两人同时推进（一人点指认、一人轮询触发超时）时只有一个写得进。
--   随 game_rooms 级联删除。game_rooms.game 本就是自由文本，新增 'shipo' 不需改表。

CREATE TABLE IF NOT EXISTS shipo_states (
  room_id uuid PRIMARY KEY REFERENCES game_rooms (id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  rev int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipo_states ENABLE ROW LEVEL SECURITY;
