-- UR H.2 酒桌游戏向陌生人开放＋房内聊天＋举报（想法 #7）。
-- 可重放：IF NOT EXISTS 全套。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   game_join_requests（陌生人凭码申请，房主审批；唯一 (room_id,user_id) WHERE pending；
--     5 分钟未处理懒过期，沿 rooms touch 口径）。
--   game_room_messages（房内文字＋快捷语；唯一 (room_id,client_msg_id) 幂等；
--     removed_at/removed_reason 撤回；room 删级联带走，另有 24h 懒删）。
--   game_reports（举报玩家；唯一 (room_id,reporter_id,target_id)；第一版只记录不扣分）。
--   game_mutes（房内禁言到本房结束；room 删级联带走）。
--   users.game_banned_until（禁玩到期；join／建房校验，NULL＝正常）。
--   RLS 全开零 policy（service 读写，沿 0042）。

CREATE TABLE IF NOT EXISTS game_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS game_join_requests_room_idx ON game_join_requests (room_id, status, created_at);
CREATE INDEX IF NOT EXISTS game_join_requests_user_idx ON game_join_requests (user_id, status, created_at DESC);
ALTER TABLE game_join_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','quick')),
  body text NOT NULL DEFAULT '',
  quick_key text,
  client_msg_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_reason text,
  UNIQUE (room_id, client_msg_id)
);
CREATE INDEX IF NOT EXISTS game_room_messages_room_idx ON game_room_messages (room_id, created_at);
ALTER TABLE game_room_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('harassment','cheating','inappropriate','other','safety')),
  detail text CHECK (detail IS NULL OR (char_length(detail) BETWEEN 1 AND 200)),
  message_id uuid REFERENCES game_room_messages (id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  ai_flagged boolean NOT NULL DEFAULT false,
  ai_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  UNIQUE (room_id, reporter_id, target_id),
  CHECK (reporter_id <> target_id)
);
CREATE INDEX IF NOT EXISTS game_reports_room_idx ON game_reports (room_id, status, created_at DESC);
ALTER TABLE game_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_mutes (
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE game_mutes ENABLE ROW LEVEL SECURITY;

ALTER TABLE users ADD COLUMN IF NOT EXISTS game_banned_until timestamptz;
