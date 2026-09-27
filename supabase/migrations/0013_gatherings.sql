-- EPIC F 组局（UR F.1）：gatherings + members + applications + moderation logs
-- Dashboard SQL Editor 贴上执行（IF NOT EXISTS 全套，可重放）
-- 主题以交友聚会为主，地点仅地图选点（place_id），描述必填，年龄申明一票否决

-- 0. 主题枚举（F.1 加强后 6 类，以交友聚会为导向）
DO $$ BEGIN
  CREATE TYPE gathering_theme AS ENUM ('friend_new','casual','party','outdoor','game','soft');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gathering_visibility AS ENUM ('public','friends');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gathering_approval AS ENUM ('manual','auto');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gathering_status AS ENUM ('open','full','ongoing','completed','cancelled','pending_review','expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. 组局主表
CREATE TABLE IF NOT EXISTS gatherings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 2 AND char_length(title) <= 30),
  theme gathering_theme NOT NULL DEFAULT 'friend_new',
  description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 200),
  -- 地点仅地图选点：POI 名称 + place_id + 坐标（模糊存，精确仅确认后可见，应用层控制）
  location_text text NOT NULL,
  place_id text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  venue_id uuid NULL REFERENCES venues (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity smallint NOT NULL CHECK (capacity >= 2 AND capacity <= 8),
  visibility gathering_visibility NOT NULL DEFAULT 'public',
  approval_mode gathering_approval NOT NULL DEFAULT 'manual',
  -- 带的酒/食物全主题非必填
  bring_text text NULL CHECK (bring_text IS NULL OR char_length(bring_text) <= 30),
  -- 年龄申明：是否有未成年人（必填，true 直接拒绝，由应用层拦截，库层存档）
  age_has_minor boolean NOT NULL DEFAULT false,
  status gathering_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (starts_at > now() - interval '1 minute')
);
CREATE INDEX IF NOT EXISTS gatherings_host_idx ON gatherings (host_id, status);
CREATE INDEX IF NOT EXISTS gatherings_starts_idx ON gatherings (starts_at);
CREATE INDEX IF NOT EXISTS gatherings_status_idx ON gatherings (status);
CREATE INDEX IF NOT EXISTS gatherings_visibility_idx ON gatherings (visibility);

-- 2. 成员
CREATE TABLE IF NOT EXISTS gathering_members (
  gathering_id uuid NOT NULL REFERENCES gatherings (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host','participant')),
  bring_text text NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz NULL,
  PRIMARY KEY (gathering_id, user_id)
);
CREATE INDEX IF NOT EXISTS gathering_members_user_idx ON gathering_members (user_id);

-- 3. 申请
CREATE TABLE IF NOT EXISTS gathering_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id uuid NOT NULL REFERENCES gatherings (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 100),
  bring_text text NULL CHECK (bring_text IS NULL OR char_length(bring_text) <= 30),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gathering_id, user_id)
);
CREATE INDEX IF NOT EXISTS gathering_applications_gathering_idx ON gathering_applications (gathering_id, status);

-- 4. 审核日志（F.7 联动，F.1 先建表）
CREATE TABLE IF NOT EXISTS gathering_moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id uuid NULL REFERENCES gatherings (id) ON DELETE SET NULL,
  application_id uuid NULL REFERENCES gathering_applications (id) ON DELETE SET NULL,
  field text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('pass','review','block')),
  reason text NOT NULL,
  model_version text NOT NULL DEFAULT 'rule-v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_gathering_idx ON gathering_moderation_logs (gathering_id);

-- 5. venues 占位（F.6 正式表未建前，F.1 先建最小表以满足外键）
CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  license_no text NULL,
  verified boolean NOT NULL DEFAULT false,
  badge_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. RLS
ALTER TABLE gatherings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gathering_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE gathering_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE gathering_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- gatherings: public 局全员可读，friends 局仅好友可见（应用层二次过滤，RLS 先放行 public + 自己发的）
DROP POLICY IF EXISTS "gatherings public read" ON gatherings;
CREATE POLICY "gatherings public read"
  ON gatherings FOR SELECT
  USING (visibility = 'public' OR host_id = auth.uid());

DROP POLICY IF EXISTS "gatherings host insert" ON gatherings;
CREATE POLICY "gatherings host insert"
  ON gatherings FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "gatherings host update" ON gatherings;
CREATE POLICY "gatherings host update"
  ON gatherings FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "members self read" ON gathering_members;
CREATE POLICY "members self read"
  ON gathering_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM gatherings g WHERE g.id = gathering_id AND g.host_id = auth.uid()));

DROP POLICY IF EXISTS "applications member read" ON gathering_applications;
CREATE POLICY "applications member read"
  ON gathering_applications FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM gatherings g WHERE g.id = gathering_id AND g.host_id = auth.uid()));

DROP POLICY IF EXISTS "applications self insert" ON gathering_applications;
CREATE POLICY "applications self insert"
  ON gathering_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- venues 全员可读，运营可写（MVP 先全员可读）
DROP POLICY IF EXISTS "venues read" ON venues;
CREATE POLICY "venues read" ON venues FOR SELECT USING (true);
