-- UR E.23 公開攢局看板：parties＋joins（iOS-0.57 联调）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   参加不开好友（陌生人语义；群聊/候补/踢人/签到/推送二期）；
--   secret 性别只占开放席（路由判，不进 RLS）；
--   到期归档另议（本轮只 hide：expires_at 过滤，行保留）。

CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place text NOT NULL CHECK (char_length(place) BETWEEN 1 AND 30),
  poi_id text,
  city text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  start_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  seats_total integer NOT NULL CHECK (seats_total BETWEEN 2 AND 12),
  seats_male integer NOT NULL DEFAULT 0 CHECK (seats_male >= 0),
  seats_female integer NOT NULL DEFAULT 0 CHECK (seats_female >= 0),
  min_members integer NOT NULL DEFAULT 2,
  bill_intent text NOT NULL DEFAULT 'flexible' CHECK (bill_intent IN ('host', 'aa', 'flexible')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seats_male + seats_female <= seats_total),
  CHECK (min_members >= 2 AND min_members <= seats_total)
);

CREATE TABLE IF NOT EXISTS joins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, user_id)
);
CREATE INDEX IF NOT EXISTS joins_party_idx ON joins (party_id);
-- 看板列表（status＋expires_at 过滤）＋城市＋host 日限额查询用。
CREATE INDEX IF NOT EXISTS parties_open_expires_idx ON parties (expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS parties_city_idx ON parties (city);
CREATE INDEX IF NOT EXISTS parties_host_idx ON parties (host_user_id, created_at DESC);

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE joins ENABLE ROW LEVEL SECURITY;

-- parties 全公开可读（昵称公开，公开帖语义）。
DROP POLICY IF EXISTS "parties public read" ON parties;
CREATE POLICY "parties public read" ON parties FOR SELECT USING (true);

-- 建局：仅登录（隐身/未成年由路由判，不进 RLS）。
DROP POLICY IF EXISTS "parties authed insert" ON parties;
CREATE POLICY "parties authed insert"
  ON parties FOR INSERT WITH CHECK (host_user_id = auth.uid());

-- 撤局：仅 host（status 翻 cancelled，行保留审计）。
DROP POLICY IF EXISTS "parties host update" ON parties;
CREATE POLICY "parties host update"
  ON parties FOR UPDATE
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

-- joins 全公开可读（成员昵称公开）。
DROP POLICY IF EXISTS "joins public read" ON joins;
CREATE POLICY "joins public read" ON joins FOR SELECT USING (true);

-- 参加：本人行（防代占位）。
DROP POLICY IF EXISTS "joins owner insert" ON joins;
CREATE POLICY "joins owner insert"
  ON joins FOR INSERT WITH CHECK (user_id = auth.uid());

-- 退席：仅本人删自己的 join。
DROP POLICY IF EXISTS "joins owner delete" ON joins;
CREATE POLICY "joins owner delete"
  ON joins FOR DELETE USING (user_id = auth.uid());
