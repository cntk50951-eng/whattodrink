-- UR B.3 联调返工：chat_mutes（删好友禁言专用，与手动 cheers_blocks 分离）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   解除好友只禁聊天（用户定案）：禁言行走本表，碰杯／打卡互动不受影响
--   （cheers 发送从不查屏蔽表，实测确认，故拆表即语义正确，无需改 cheers 侧）；
--   本表只存自动行（删好友产生），无手动入口 → 成对清除安全；
--   RLS 沿 cheers_blocks own-all 口径（只本人行）。
--   旧数据：已产生的解除双拉黑行留在 cheers_blocks（手动屏蔽继续有效，不迁移）。

CREATE TABLE IF NOT EXISTS chat_mutes (
  blocker_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE chat_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_mutes own all" ON chat_mutes;
CREATE POLICY "chat_mutes own all"
  ON chat_mutes FOR ALL
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());
