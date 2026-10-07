-- UR E.14 round-5 防重刷：一人一帖一行（iOS-0.53 联调）。
-- 可重放：先去重後加約束，全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   现有重复对只留最早一行（created_at＋id 双序）；checkin_id NULL 行
--   （历史遗留）PG 唯一约束天然放过，不处理；
--   回敬行 checkin 非空（路由落帖才写），同受约束；
--   POST 重复走 200 幂等（路由改），409 不用。
DELETE FROM cheers a
USING cheers b
WHERE a.checkin_id IS NOT NULL
  AND a.from_user_id = b.from_user_id
  AND a.checkin_id = b.checkin_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cheers_from_post_unique'
  ) THEN
    ALTER TABLE cheers ADD CONSTRAINT cheers_from_post_unique
      UNIQUE (from_user_id, checkin_id);
  END IF;
END
$$;
