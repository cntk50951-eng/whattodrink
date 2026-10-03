-- UR E.12 打卡评分改他人制＋平均分：评分明细表（一人一帖一行）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志：
--   ① "Success. No rows returned"；
--   ② Table Editor 见 checkin_ratings 空表。
-- 说明：
--   0017 checkins.rating（作者自评旧语义）本文件不动，0020 另起 drop
--   （旧产码未清前 drop 即炸 GET select，先加法）。
--   聚合一律走路由 service client（可见门在路由先验，沿 D.2 口径），
--   RLS 只做纵深：公开帖可读＋本人行读写；friends 帖他人行直读被挡，
--   合法读全走 gated route（平均＋my 行），不泄露谁投几分。
--   作者禁投由路由强制（RLS 表达帖归属贵，路由 eq user_id 判）。

-- 1. 明细：每人每帖一行（PK 天然一人一票；改分即 upsert 覆盖，null 即删行撤分）。
--    仅登录可写（user_id NOT NULL；匿名由路由 401 拦，不进表）。
CREATE TABLE IF NOT EXISTS checkin_ratings (
  checkin_id uuid NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (checkin_id, user_id)
);
CREATE INDEX IF NOT EXISTS checkin_ratings_post_idx ON checkin_ratings (checkin_id);

ALTER TABLE checkin_ratings ENABLE ROW LEVEL SECURITY;

-- 读：公开帖的明细行人人可读（只为聚平均数；路由只吐聚合＋本人行，不吐谁投谁）。
DROP POLICY IF EXISTS "checkin_ratings public read" ON checkin_ratings;
CREATE POLICY "checkin_ratings public read"
  ON checkin_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checkins
      WHERE checkins.id = checkin_ratings.checkin_id
        AND checkins.visibility = 'public'
    )
  );

-- 读：本人行恒可读（my_rating 回显；friends 帖靠此行，不靠全表）。
DROP POLICY IF EXISTS "checkin_ratings own read" ON checkin_ratings;
CREATE POLICY "checkin_ratings own read"
  ON checkin_ratings FOR SELECT
  USING (user_id = auth.uid());

-- 写：仅本人行（防代投；作者禁投由路由判，不进 RLS）。
DROP POLICY IF EXISTS "checkin_ratings owner insert" ON checkin_ratings;
CREATE POLICY "checkin_ratings owner insert"
  ON checkin_ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 改：仅本人行（改分即 update 覆盖）。
DROP POLICY IF EXISTS "checkin_ratings owner update" ON checkin_ratings;
CREATE POLICY "checkin_ratings owner update"
  ON checkin_ratings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 删：仅本人行（撤分即删行，平均实时回）。
DROP POLICY IF EXISTS "checkin_ratings owner delete" ON checkin_ratings;
CREATE POLICY "checkin_ratings owner delete"
  ON checkin_ratings FOR DELETE
  USING (user_id = auth.uid());
