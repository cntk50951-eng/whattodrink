-- UR E.22 過期快貼歸檔備查：獨立表＋每日搬運（只搬不刪數，審計不斷鏈）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS＋job 先卸後掛，全套。
-- Dashboard SQL Editor 贴跑，成功标志：
--   ① "Success. No rows returned"；
--   ② Table Editor 见 checkins_archive 空表；`SELECT * FROM cron.job` 见 archive-expired-flash-daily。
-- 時間統一（本 UR 硬約束）：寫入側 `Date.now()+24h`、讀取側 `nowIso`、任務側 `now()`——
--   全是 UTC instant，零時區換算；`expires_at < now()` 即過期，24h 卡死，無模糊窗。
-- 说明：
--   歸檔表無 FK（審計行不可被級聯刪；用户/酒删了行照留）、無 CHECK（源行已驗）；
--   逐人明細不搬（讚／評誰投的另議）；CASCADE 子行（like/want/rating/comment）搬前先拍快照；
--   cheers／invites 是 SET NULL 留行，不受影響；post 永不搬（expires_at null）。

-- 0. pg_cron（Supabase Cron 引擎；若此句报权限，去 Dashboard → Database → Extensions 手开 cron）。
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. 歸檔表（checkins 全列鏡像 18 列＋歸檔戳＋6 快照計數）。
CREATE TABLE IF NOT EXISTS checkins_archive (
  id uuid PRIMARY KEY,
  user_id uuid,
  beer_id text,
  lat double precision,
  lng double precision,
  place_name text,
  photo_url text,
  audio_url text,
  audio_seconds integer,
  note text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'want',
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'flash',
  expires_at timestamptz,
  rating smallint,
  photo_thumb text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  like_count integer NOT NULL DEFAULT 0,
  want_count integer NOT NULL DEFAULT 0,
  rating_avg double precision,
  rating_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  cheers_count integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS checkins_archive_user_idx ON checkins_archive (user_id, created_at DESC);

ALTER TABLE checkins_archive ENABLE ROW LEVEL SECURITY;

-- 读：本人行（足跡回看＋审计自查；service 全权另走 bypass）。
DROP POLICY IF EXISTS "checkins_archive owner read" ON checkins_archive;
CREATE POLICY "checkins_archive owner read"
  ON checkins_archive FOR SELECT
  USING (user_id = auth.uid());

-- 2. 搬運函數（單事務快照＋搬＋刪；同 snapshot 下子查詢計數一致；冪等可重跑）。
CREATE OR REPLACE FUNCTION archive_expired_flash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved integer := 0;
BEGIN
  WITH doomed AS (
    SELECT id FROM checkins
    WHERE kind = 'flash' AND expires_at IS NOT NULL AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  ),
  ins AS (
    INSERT INTO checkins_archive (
      id, user_id, beer_id, lat, lng, place_name, photo_url, audio_url,
      audio_seconds, note, transcript, type, visibility, created_at, kind,
      expires_at, rating, photo_thumb, archived_at,
      like_count, want_count, rating_avg, rating_count, comment_count, cheers_count,
      tags
    )
    SELECT
      c.id, c.user_id, c.beer_id, c.lat, c.lng, c.place_name, c.photo_url, c.audio_url,
      c.audio_seconds, c.note, c.transcript, c.type, c.visibility, c.created_at, c.kind,
      c.expires_at, c.rating, c.photo_thumb, now(),
      (SELECT count(*) FROM post_likes WHERE post_id = c.id),
      (SELECT count(*) FROM checkin_wants WHERE checkin_id = c.id),
      (SELECT avg(rating)::float8 FROM checkin_ratings WHERE checkin_id = c.id),
      (SELECT count(*) FROM checkin_ratings WHERE checkin_id = c.id),
      (SELECT count(*) FROM checkin_comments WHERE checkin_id = c.id AND status = 'visible'),
      (SELECT count(*) FROM cheers WHERE checkin_id = c.id)
    FROM checkins c JOIN doomed d ON d.id = c.id
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ),
  del AS (
    DELETE FROM checkins c USING doomed d WHERE c.id = d.id
    RETURNING c.id
  )
  SELECT count(*) INTO moved FROM del;
  RETURN moved;
END;
$$;

-- 3. 每日 04:00 HKT（＝UTC 前日 20:00；庫是 UTC，cron 按 UTC 寫，見 UR）。
DO $$
BEGIN
  PERFORM cron.unschedule('archive-expired-flash-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;
SELECT cron.schedule('archive-expired-flash-daily', '0 20 * * *', $$SELECT archive_expired_flash()$$);
