-- UR E.22 審計視圖：歸檔行＋發帖人＋酒名（只讀，Dashboard 備查用）。
-- 可重放：OR REPLACE 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：VIEW 無 RLS（讀底表 RLS；Dashboard 用 service role 全見）；
-- App 不走此視圖（詳情回退沿既有 service 直查），零前端影響。
CREATE OR REPLACE VIEW checkins_archive_detailed AS
SELECT
  a.id,
  a.created_at,
  a.expires_at,
  a.archived_at,
  a.kind,
  a.visibility,
  u.nickname AS author,
  b.name AS beer,
  a.place_name,
  a.note,
  a.like_count,
  a.want_count,
  a.rating_avg,
  a.rating_count,
  a.comment_count,
  a.cheers_count,
  a.user_id
FROM checkins_archive a
LEFT JOIN users u ON u.id = a.user_id
LEFT JOIN beers b ON b.id = a.beer_id;
