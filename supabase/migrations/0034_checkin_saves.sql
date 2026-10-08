-- UR E.26 打卡收藏：checkin_saves（私人书签；无公开计数）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"＋Table Editor 见空表。
-- 说明（与交接两处对齐）：
--   FK 用 users(id)（全仓惯例，不用交接原文 auth.users）；
--   RLS 拆三条（owner select／insert／delete，沿 0018 口径；交接单条 FOR ALL 只有 USING、
--   无 WITH CHECK 会堵 INSERT，故不用）。

CREATE TABLE IF NOT EXISTS checkin_saves (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  checkin_id uuid NOT NULL REFERENCES checkins (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, checkin_id)
);
CREATE INDEX IF NOT EXISTS checkin_saves_user_created_idx
  ON checkin_saves (user_id, created_at DESC);

ALTER TABLE checkin_saves ENABLE ROW LEVEL SECURITY;

-- 本人读（我的收藏列表走 authed client）。
DROP POLICY IF EXISTS "checkin_saves owner read" ON checkin_saves;
CREATE POLICY "checkin_saves owner read"
  ON checkin_saves FOR SELECT USING (user_id = auth.uid());

-- 收藏：仅本人行（防代收）。
DROP POLICY IF EXISTS "checkin_saves owner insert" ON checkin_saves;
CREATE POLICY "checkin_saves owner insert"
  ON checkin_saves FOR INSERT WITH CHECK (user_id = auth.uid());

-- 取收：仅本人行。
DROP POLICY IF EXISTS "checkin_saves owner delete" ON checkin_saves;
CREATE POLICY "checkin_saves owner delete"
  ON checkin_saves FOR DELETE USING (user_id = auth.uid());
