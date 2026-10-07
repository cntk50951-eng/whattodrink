-- UR E.14 round-5 取消碰杯缺 DELETE RLS（iOS 实测：DELETE 次次 200 但行还在；
-- cheers 表只有 SELECT／INSERT／UPDATE（0021），无授权 delete 静默 no-op）。
-- 可重放：DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
DROP POLICY IF EXISTS "cheers owner delete" ON cheers;
CREATE POLICY "cheers owner delete"
  ON cheers FOR DELETE
  USING (from_user_id = auth.uid());
