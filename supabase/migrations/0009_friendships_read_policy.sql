-- UR A.17 好友模式：friendships 自讀＋checkins friends 行讀。
-- RLS 逐洞開（沿 api-workflow 一洞一 policy）；寫（insert/update/delete）續拒——
-- 加好友／接受流程另議，V1 驗證行由用戶在 Dashboard 手插。
-- Dashboard SQL Editor 貼上執行（可重放：DROP IF EXISTS＋CREATE）。

-- 1. friendships 自讀：只看得到自己是任一端的行
DROP POLICY IF EXISTS "friendships self read" ON friendships;
CREATE POLICY "friendships self read"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 2. checkins friends 行讀：visibility='friends' 且與作者互為 accepted 好友
DROP POLICY IF EXISTS "checkins friends read" ON checkins;
CREATE POLICY "checkins friends read"
  ON checkins FOR SELECT
  USING (
    visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = checkins.user_id)
          OR (f.friend_id = auth.uid() AND f.user_id = checkins.user_id)
        )
    )
  );
