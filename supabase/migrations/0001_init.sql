-- UR A.3 / A.2-1：九表一次建好（沿 docs/data/future-schema.md＋A.1 分析師缺口）。
-- RLS 全表 ENABLE 但零 policy＝預設全拒；policy 是 A.2-2 的事。
-- 匿名期 user_id 全 NULL（A.3 認領再回填）；牆種子不進庫（假用戶數據不污染真表）。

-- gender 三值沿 UR2.0（lib/me.ts 直遷無改名）
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  avatar_url text,
  gender text NOT NULL DEFAULT 'secret' CHECK (gender IN ('male', 'female', 'secret')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- UR3.3 在線查詢（last_seen_at >= now-5min，口徑同 isNearbyOnline）
CREATE INDEX users_last_seen_idx ON users (last_seen_at);

CREATE TABLE beers (
  id text PRIMARY KEY,
  emoji text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  tagline text NOT NULL DEFAULT ''
);

CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  beer_id text REFERENCES beers (id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  place_name text,
  photo_url text,
  audio_url text,
  audio_seconds integer CHECK (audio_seconds IS NULL OR audio_seconds >= 0),
  note text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'want' CHECK (type IN ('want', 'share', 'mood')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 不加 share⇒public 硬約束：將來「隱藏自己帖子」要的就是 share＋private；
-- 可見性由寫入流程（分享才設 public）＋RLS 執法，不由表約束鎖死。

CREATE TABLE cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  checkin_id uuid REFERENCES checkins (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cheers_from_day_idx ON cheers (from_user_id, created_at);
-- 牆最新流按 created_at 倒序（WallGrid sortLatest）
CREATE INDEX checkins_created_idx ON checkins (created_at DESC);

CREATE TABLE mood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  mood_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drink_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  checkin_id uuid REFERENCES checkins (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'accepted', 'declined', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 牆＝type='share' 的 checkins；讚／檢舉掛 checkin id（沿 UR4.1 口徑）
CREATE TABLE post_likes (
  post_id uuid NOT NULL REFERENCES checkins (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_likes_hot_idx ON post_likes (created_at);

CREATE TABLE post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES checkins (id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('web', 'ios', 'aos')),
  push_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, push_token)
);

-- 全拒：A.2-2 之前任何 key（連 anon）都讀寫不了，空窗期安全。
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE beers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
