-- UR H.3 誰是臥底（真聯機）。
-- Dashboard SQL Editor 贴上执行（可重放：IF NOT EXISTS）。成功标志："Success. No rows returned"，
-- Table Editor 见 spy_states 空表。
-- 说明：
--   整局状态（每人的词与身份、发言顺序、截止时间、投票）存一份 jsonb；只有 service_role 能读写
--   （RLS 全开零 policy＝默认全拒），词与身份只按人裁剪后由 GET /games/rooms/{id} 下发。
--   rev＝乐观锁：两人同时推进（一人按「说完了」、一人轮询触发超时）时只有一个写得进。
--   随 game_rooms 级联删除（房过期／房主注销都会带走）。
--   game_rooms.game 本就是自由文本（无 CHECK），新增 'spy' 不需改表。

CREATE TABLE IF NOT EXISTS spy_states (
  room_id uuid PRIMARY KEY REFERENCES game_rooms (id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  rev int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spy_states ENABLE ROW LEVEL SECURITY;
