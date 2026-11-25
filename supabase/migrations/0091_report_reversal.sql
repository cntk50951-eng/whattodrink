-- 0091 舉報改判不成立：記下帖子被下架前的可見性，改判時才能還原（iOS DEF-20261125-021，2026-11-25）
-- 只對之後的處分有效；0091 前已下架的帖子沒有記錄，改判時保持隱藏並在後台提示人工處理。
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS hidden_prev_visibility text;
ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_hidden_prev_visibility_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_hidden_prev_visibility_check
  CHECK (hidden_prev_visibility IS NULL OR hidden_prev_visibility IN ('public', 'friends', 'private'));
