-- UR E.10 batch2：post_likes 写 policy（读沿 0005 公开帖口径已有）。
-- post_likes 表 0001 已建（post_id＋user_id 双列 PK 天然防重赞）。
-- 可重放：DROP IF EXISTS 全套。Dashboard SQL Editor 贴跑，
-- 成功标志 "Success. No rows returned"（policy 替换无输出行）。

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 点赞：仅本人行（防代点；匿名无 uid 由路由 401 拦，不进表）。
DROP POLICY IF EXISTS "post_likes owner insert" ON post_likes;
CREATE POLICY "post_likes owner insert"
  ON post_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 取消赞：仅本人行（删行即计数减一）。
DROP POLICY IF EXISTS "post_likes owner delete" ON post_likes;
CREATE POLICY "post_likes owner delete"
  ON post_likes FOR DELETE
  USING (user_id = auth.uid());
