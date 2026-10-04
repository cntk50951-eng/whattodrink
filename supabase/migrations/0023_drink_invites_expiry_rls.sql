-- UR E.16 約喝酒邀請：时效字段＋召回态＋RLS（0001 建表零 policy 即全拒）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   时效由 expires_at 表达（服务端读时判过期，无 cron；过期接受 410）。
--   recalled 走状态（删行即丢审计＋对方“未成局”无从解释，留行置态）。
--   屏蔽举報复用 cheers_blocks／cheers_reports（按人，與敬酒同一騷擾向量）。

-- 1. 时效＋场所字段。
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS place text NOT NULL DEFAULT '';
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS start_at timestamptz;
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS expires_at timestamptz;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drink_invites_status_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%recalled%'
  ) THEN
    ALTER TABLE drink_invites DROP CONSTRAINT drink_invites_status_check;
    ALTER TABLE drink_invites ADD CONSTRAINT drink_invites_status_check
      CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'recalled'));
  END IF;
END
$$;

ALTER TABLE drink_invites ENABLE ROW LEVEL SECURITY;

-- 读：本人双边行（发／收；陌生人分区只经 gated route，不直读）。
DROP POLICY IF EXISTS "drink_invites own read" ON drink_invites;
CREATE POLICY "drink_invites own read"
  ON drink_invites FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- 写：from 只能是自己（自约／隐身／限额由路由判，不进 RLS）。
DROP POLICY IF EXISTS "drink_invites owner insert" ON drink_invites;
CREATE POLICY "drink_invites owner insert"
  ON drink_invites FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- 改：双边都可推进状态（发方撤回／收方接受忽略； sterilize：只许 sent→终态，
-- 终态之间不可互转，由路由按行查，RLS 只开双边 UPDATE）。
DROP POLICY IF EXISTS "drink_invites party update" ON drink_invites;
CREATE POLICY "drink_invites party update"
  ON drink_invites FOR UPDATE
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());
