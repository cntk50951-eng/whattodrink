-- 0060 足跡回放公開設置（主頁「足跡回放」卡）：用戶是否讓好友播放自己的足跡。
-- off＝不公開（默認）；friends＝好友可見（陌生人只看到「加好友後可看」的鎖定預告，不給任何點位）。
-- 好友版數據由服務端處理：只含公開／好友可見打卡、最近 30 天、延遲 24 小時、坐標模糊到約 100 米。
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trail_visibility text NOT NULL DEFAULT 'off';
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_trail_visibility_check;
ALTER TABLE users
  ADD CONSTRAINT users_trail_visibility_check CHECK (trail_visibility IN ('off', 'friends'));
