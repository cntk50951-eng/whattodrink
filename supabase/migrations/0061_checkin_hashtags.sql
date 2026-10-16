-- 0061 打卡自定義標籤（#微醺 之類用戶自己輸入）＋我的標籤庫。
-- 先跑這條，再部署 web（讀打卡的接口會 select hashtags 列）。
-- hashtags 與 tags（酒類 taxonomy）分開存：自定義標籤不進口味推測。
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';
ALTER TABLE checkins_archive ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';

-- 我的標籤庫：按用戶存用過的標籤（次數＋最近使用），下次輸入時聯想／複用。僅服務端讀寫。
CREATE TABLE IF NOT EXISTS user_hashtags (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tag text NOT NULL,
  uses integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);
ALTER TABLE user_hashtags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS user_hashtags_recent_idx ON user_hashtags (user_id, last_used_at DESC);

-- 注意：本遷移不改 archive_expired_flash()（倉庫裡 0026 的副本與線上實際版本可能不一致，不盲目覆蓋）。
-- 過期快貼歸檔時 hashtags 不會被搬進 checkins_archive（歸檔後只丟失自定義標籤，不影響其他）；
-- 如要帶上，等你確認線上函數定義後再單獨加一條遷移。
