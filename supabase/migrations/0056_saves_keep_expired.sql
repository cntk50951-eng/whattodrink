-- UR G.9 過期收藏保留（WEB_HANDOFF_SAVES_EXPIRED）。
-- 背景：24h 快貼歸檔時 `DELETE FROM checkins` 經 FK 級聯刪掉 `checkin_saves` 行，
-- 用戶的過期收藏直接消失。本遷移去掉該 FK（留列，收藏行永久保留，歸檔不再連帶刪）。
-- 讀側由 `GET /me/saves` 回頭查 `checkins_archive` 並標 `expired: true`（同文件路由改動）。
-- 可重放；只動約束，不碰數據；RLS 不變。

ALTER TABLE IF EXISTS checkin_saves
  DROP CONSTRAINT IF EXISTS checkin_saves_checkin_id_fkey;
