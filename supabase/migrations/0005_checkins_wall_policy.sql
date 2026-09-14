-- UR A.6 / 公開牆 API（A.4-2）：匿名可讀的三檔 policy，其餘維持全拒。
-- Dashboard SQL Editor 貼上執行（可重放：先 DROP 再建）。
-- 開洞原則（一個洞一個 policy，不多開）：
--   1. checkins：只開 visibility='public' 的行（private 行匿名照樣看不見）。
--   2. users：只開「發過公開帖」的用户行（暱稱／頭像／性別本來就是公開列；
--      last_seen_at 已被前端在線查詢讀，不新增暴露）。
--   3. post_likes：只開「公開帖」的讚行（只為聚合計數；route 只吐總數，
--      不吐誰讚了誰；private 帖的讚匿名不可見）。

DROP POLICY IF EXISTS "checkins wall public read" ON checkins;
CREATE POLICY "checkins wall public read"
  ON checkins FOR SELECT
  USING (visibility = 'public');

DROP POLICY IF EXISTS "users wall public read" ON users;
CREATE POLICY "users wall public read"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checkins
      WHERE checkins.user_id = users.id
        AND checkins.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS "post_likes wall public read" ON post_likes;
CREATE POLICY "post_likes wall public read"
  ON post_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM checkins
      WHERE checkins.id = post_likes.post_id
        AND checkins.visibility = 'public'
    )
  );
