-- UR D.9 iOS 真推送 P1（E1 碰杯＋APNs 通道）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"。
-- 说明：
--   devices 行永不回客户端（沿架构 §143）；写走 gated route＋service；
--   push_log RLS 开零 policy（默认全拒，只走 service；无 token 无正文）。

ALTER TABLE devices ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS locale text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_prefs jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedupe_key text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_log_recipient_idx ON push_log (recipient_id, created_at DESC);
ALTER TABLE push_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id) WHERE enabled;

-- 本人行四件套（select 不开列表口，只给本人单行读写；token 永不经 list 出）。
DROP POLICY IF EXISTS "devices owner read" ON devices;
CREATE POLICY "devices owner read"
  ON devices FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "devices owner insert" ON devices;
CREATE POLICY "devices owner insert"
  ON devices FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "devices owner update" ON devices;
CREATE POLICY "devices owner update"
  ON devices FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "devices owner delete" ON devices;
CREATE POLICY "devices owner delete"
  ON devices FOR DELETE USING (user_id = auth.uid());
