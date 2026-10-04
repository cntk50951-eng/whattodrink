-- UR E.15 乾杯信箱系：留言列＋燒毀保留＋屏蔽舉報表。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套（FK 先查名再動，見下）。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   去 CASCADE（E.15 定案記錄保留）：帖烧毁 checkin_id 置空，行留作历史，
--   界面悬空显示“已消失的打卡”。约束名按 PG 默认 `cheers_checkin_id_fkey`，
--   若库里异名（\d cheers 对）把下面两处同改。

-- 1. 快捷留言列（40 字由客户端限，服务端截 200 兜底；空即无）。
ALTER TABLE cheers ADD COLUMN IF NOT EXISTS message text;

-- 2. 去 CASCADE（烧毁保留行；悬空行界面显示已消失）。
ALTER TABLE cheers DROP CONSTRAINT IF EXISTS cheers_checkin_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cheers_checkin_id_setnull'
  ) THEN
    ALTER TABLE cheers ADD CONSTRAINT cheers_checkin_id_setnull
      FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- 3. 屏蔽表（blocker 不再收到 blocked 的敬；发送侧路由判， quiet fail）。
CREATE TABLE IF NOT EXISTS cheers_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE cheers_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cheers_blocks own all" ON cheers_blocks;
CREATE POLICY "cheers_blocks own all"
  ON cheers_blocks FOR ALL
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- 4. 举报表（陌生骚扰向量；审核队列另议， started 只存）。
CREATE TABLE IF NOT EXISTS cheers_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cheers_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cheers_reports own insert" ON cheers_reports;
CREATE POLICY "cheers_reports own insert"
  ON cheers_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "cheers_reports own read" ON cheers_reports;
CREATE POLICY "cheers_reports own read"
  ON cheers_reports FOR SELECT
  USING (reporter_id = auth.uid());
