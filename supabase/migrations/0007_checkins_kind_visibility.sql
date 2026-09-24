-- UR A.12 打卡雙類型 + 三模式桩位
-- 1. checkins.kind + expires_at + visibility 扩 'friends'
-- 2. users.mode + mode_updated_at
-- 3. friendships 好友桩位（A.12 仅建表）

-- checkins.kind: 'flash' 24h 快貼, 'post' 永久帖子
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'flash' CHECK (kind IN ('flash','post'));

ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 旧行補 expires_at（flash 為創建+24h，post 已是 NULL，舊行皆視為 flash）
UPDATE checkins SET expires_at = created_at + interval '24 hours' WHERE kind = 'flash' AND expires_at IS NULL;

-- visibility 扩 'friends'（保留 private 舊行，新增 friends 供好友模式）
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_visibility_check;
ALTER TABLE checkins ADD CONSTRAINT checkins_visibility_check CHECK (visibility IN ('private','public','friends'));

-- users.mode: 預設公開（本次確認），隱身/好友/公開三檔
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'public' CHECK (mode IN ('stealth','friends','public'));
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mode_updated_at timestamptz NOT NULL DEFAULT now();

-- friendships 桩位（A.12 僅建表，後續 UR 接寫讀/RLS）
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);
CREATE INDEX IF NOT EXISTS friendships_user_idx ON friendships (user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_idx ON friendships (friend_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
-- 暫全拒（A.12 不開放讀寫），後續 UR 按 owner 開放
