-- 阶段 C2：safety 告警表（人工后台看；邮件／告警以后再接，先只落库）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：safety_alerts（complaint 触发 safety／升级时写一行；handled_at 供后台签收）；
--   RLS 全 ENABLE 零 policy（service 读写）。

CREATE TABLE IF NOT EXISTS safety_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints (id) ON DELETE CASCADE,
  party_id uuid REFERENCES parties (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);
CREATE INDEX IF NOT EXISTS safety_alerts_open_idx ON safety_alerts (created_at DESC) WHERE handled_at IS NULL;
ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;
