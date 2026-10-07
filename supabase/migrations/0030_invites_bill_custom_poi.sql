-- UR E.16 round-2 iOS 邀约增强：买单意图＋自定义时间＋POI（iOS-0.54 联调）。
-- 可重放：IF NOT EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：旧行 bill_intent 全 backfill 'flexible'（DEFAULT 即回填，无需 UPDATE）；
-- custom 时间走现有 start_at 列（GET 不回显新字段，沿 iOS spec）。
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS bill_intent text NOT NULL DEFAULT 'flexible';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drink_invites_bill_intent_check'
  ) THEN
    ALTER TABLE drink_invites ADD CONSTRAINT drink_invites_bill_intent_check
      CHECK (bill_intent IN ('host', 'aa', 'flexible'));
  END IF;
END
$$;
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS custom_time timestamptz;
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS poi_id text;
