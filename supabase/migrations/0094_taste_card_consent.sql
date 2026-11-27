-- 0094 AI 口味卡專屬同意（iOS 外部審核 IOS-C01；Apple 5.1.2）。可重放。
-- 以前打開主頁就自動把偏好、打卡彙總與 Ivy 記憶送 MiniMax 生成口味卡，沒有專屬同意，生成的卡默認對他人公開。
-- 改為：
--   consented_at：用戶在 App 內同意「用 AI 生成口味卡」的時間；null＝沒同意（不生成、不對他人顯示）。
--   visible 默認改 false（新卡只有自己看得到，用戶自己決定要不要公開）。
--   既有的卡都是在沒有同意的情況下生成的：一律改為不公開（本人重新同意後可再生成、自行公開）。
ALTER TABLE user_taste_cards ADD COLUMN IF NOT EXISTS consented_at timestamptz;
ALTER TABLE user_taste_cards ALTER COLUMN visible SET DEFAULT false;
UPDATE user_taste_cards SET visible = false WHERE consented_at IS NULL AND visible = true;
