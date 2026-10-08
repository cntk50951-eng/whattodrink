-- UR E.16 round-5 iOS 完成态：status 放行 completed（iOS-0.55 联调）。
-- 可重放：按名查有无 completed 再动，全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drink_invites_status_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%completed%'
  ) THEN
    ALTER TABLE drink_invites DROP CONSTRAINT drink_invites_status_check;
    ALTER TABLE drink_invites ADD CONSTRAINT drink_invites_status_check
      CHECK (status IN ('sent', 'accepted', 'declined', 'expired', 'recalled', 'completed'));
  END IF;
END
$$;
