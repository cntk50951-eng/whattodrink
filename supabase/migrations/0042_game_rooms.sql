-- UR H.1 游戏房间＋大話骰 POC（0042）：五表＋RLS 全锁死（service 读写，沿 push_log）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   game_rooms（code 仅活跃房间内唯一：partial unique WHERE status<>'ended'，过期重用无妨）；
--   version 每次状态变化 +1（GET since／actions expected_version 对账用）；
--   expires_at 无操作 2h（懒续＋懒删，无 cron：touch 时续期，过期即 end＋删数）；
--   game_rounds.dice 只 service 读（RLS 零 policy，客户端直读恒空，防作弊）；
--   game_events.UNIQUE(room_id, version) 单调＋UNIQUE(room_id, client_action_id) 幂等
--     （client_action_id 可空，null 多行不冲突；服务端 auto 事件自填 `auto:<uuid>`）；
--   game_invites.UNIQUE(room_id, to_user_id) WHERE pending（重复邀请幂等）；
--   结算只记 loser_id（谁输，不记喝多少；房间删即联级联带走，不进档案不排行）。

CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  game text NOT NULL DEFAULT 'liars_dice',
  host_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'lobby',
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_players int NOT NULL DEFAULT 6,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + make_interval(hours => 2),
  ended_at timestamptz
);
DROP INDEX IF EXISTS game_rooms_code_active;
CREATE UNIQUE INDEX game_rooms_code_active ON game_rooms (code) WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS game_rooms_host_idx ON game_rooms (host_id);
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_room_players (
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  seat int NOT NULL DEFAULT 0,
  ready boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS game_room_players_user_idx ON game_room_players (user_id);
ALTER TABLE game_room_players ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  no int NOT NULL DEFAULT 1,
  starter_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bidding',
  dice jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_turn_user uuid REFERENCES users (id) ON DELETE SET NULL,
  turn_deadline timestamptz,
  last_bid jsonb,
  bids jsonb NOT NULL DEFAULT '[]'::jsonb,
  loser_id uuid REFERENCES users (id) ON DELETE SET NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, no)
);
CREATE INDEX IF NOT EXISTS game_rounds_room_idx ON game_rounds (room_id);
ALTER TABLE game_rounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  version int NOT NULL,
  type text NOT NULL,
  actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_action_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, version),
  UNIQUE (room_id, client_action_id)
);
CREATE INDEX IF NOT EXISTS game_events_room_ver_idx ON game_events (room_id, version);
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms (id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
DROP INDEX IF EXISTS game_invites_pending_one;
CREATE UNIQUE INDEX game_invites_pending_one ON game_invites (room_id, to_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS game_invites_to_idx ON game_invites (to_user_id, status);
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;
