-- UR A.19＋DEF-20260926-009：好友邀請寫入（pending 發起＋雙向接受翻轉）。
-- 加好友完整流程（搜尋／列表／拒絕 UI）另議；V1 僅邀請＋雙向 pending 即接受，
-- 免接受 UI（雙向 opt-in，無騷擾風險；單向永遠是 pending，可靜置）。
-- Dashboard SQL Editor 貼上執行（可重放：DROP IF EXISTS＋CREATE）。

-- 1. 發起邀請：只能以自己名義發 pending（防偽造；自加由 route 再驗，DB 兜底禁自環）
DROP POLICY IF EXISTS "friendships insert request" ON friendships;
CREATE POLICY "friendships insert request"
  ON friendships FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND user_id <> friend_id
    AND status = 'pending'
  );

-- 2. 接受翻轉：任一端可把 pending 翻 accepted（對方也加過我即成好友）；
--    行內雙方身份不可換（防劫持他人關係行）；accepted→pending 即絕交，沿社交語義。
DROP POLICY IF EXISTS "friendships accept flip" ON friendships;
CREATE POLICY "friendships accept flip"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (
    (auth.uid() = user_id OR auth.uid() = friend_id)
    AND status IN ('pending', 'accepted')
  );
