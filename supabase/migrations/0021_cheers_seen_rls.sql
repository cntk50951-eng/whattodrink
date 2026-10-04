-- UR E.14 v2 乾杯儀式＋雙邊記錄：已讀水位＋RLS（0001 建表零 policy 即全拒）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志：
--   ① "Success. No rows returned"；
--   ② Table Editor 见 cheers 多 seen_at 列。
-- 说明：一行雙讀（from／to／checkin，沿 UR 3.0 口徑；checkin 可空＝人級回敬位，
-- 0001 列本就 nullable）；未讀＝seen_at IS NULL；開自己面板即全標已讀
-- （fire-and-forget，路由 PATCH）；15／天由路由計數強制，不进 RLS。

-- 1. 已讀水位（null＝未讀）。
ALTER TABLE cheers ADD COLUMN IF NOT EXISTS seen_at timestamptz;

ALTER TABLE cheers ENABLE ROW LEVEL SECURITY;

-- 读：本人双边行（敬出＋被敬；名單只经 gated route，防直读扫全表）。
DROP POLICY IF EXISTS "cheers own read" ON cheers;
CREATE POLICY "cheers own read"
  ON cheers FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- 写：from 只能是自己（防代敬；自敬／隐身／限额由路由判，不进 RLS）。
DROP POLICY IF EXISTS "cheers owner insert" ON cheers;
CREATE POLICY "cheers owner insert"
  ON cheers FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- 改：只能标自己被敬行的已读（to＝自己；from 不可改他人行）。
DROP POLICY IF EXISTS "cheers recipient seen" ON cheers;
CREATE POLICY "cheers recipient seen"
  ON cheers FOR UPDATE
  USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());
