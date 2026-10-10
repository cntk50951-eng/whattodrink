-- UR B.3 好友请求中心：friendships 加来源列（declined 不做，拒绝即删行无冷却，用户定案）。
-- 可重放：IF NOT EXISTS。Dashboard SQL Editor 贴跑，成功 "Success. No rows returned"。
-- 说明：origin（profile/cheers/party/checkin/direct，建请求依据；iOS 列表来源展示）；
-- source_checkin_id（经打卡认识的对方帖 id，可空；被删帖 SET NULL 不断链）。

ALTER TABLE friendships ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS source_checkin_id uuid REFERENCES checkins (id) ON DELETE SET NULL;
