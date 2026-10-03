-- UR E.10 打卡面板互动升级：数据缺口（评分＋“我也想喝”计数）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志：
--   ① "Success. No rows returned"；
--   ② Table Editor 见 checkin_wants 空表＋checkins 多 rating 列。
-- RLS 沿 post_likes 口径（0005）：公开帖可读计数，写删仅本人。

-- 1. 评分：作者给自己这杯打 1–5 整数星（可空；他人只读）。
--    写走 checkins owner update 旧 policy（0006 已有），无新 policy。
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS rating smallint
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

-- 2. “我也想喝”计数：每人每帖一行（PK 天然去重一人一次）。
--    仅登录可写（user_id NOT NULL；匿名由路由 403，不进表）。
CREATE TABLE IF NOT EXISTS checkin_wants (
  checkin_id uuid NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (checkin_id, user_id)
);
CREATE INDEX IF NOT EXISTS checkin_wants_post_idx ON checkin_wants (checkin_id);

ALTER TABLE checkin_wants ENABLE ROW LEVEL SECURITY;

-- 读：公开帖的计数行人人可读（只为聚会计数；route 只吐总数，不吐谁点了谁）。
DROP POLICY IF EXISTS "checkin_wants public read" ON checkin_wants;
CREATE POLICY "checkin_wants public read"
  ON checkin_wants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checkins
      WHERE checkins.id = checkin_wants.checkin_id
        AND checkins.visibility = 'public'
    )
  );

-- 写：仅本人行（防代点）。
DROP POLICY IF EXISTS "checkin_wants owner insert" ON checkin_wants;
CREATE POLICY "checkin_wants owner insert"
  ON checkin_wants FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 删：仅本人行（取消想喝即删行，计数实时减）。
DROP POLICY IF EXISTS "checkin_wants owner delete" ON checkin_wants;
CREATE POLICY "checkin_wants owner delete"
  ON checkin_wants FOR DELETE
  USING (user_id = auth.uid());
