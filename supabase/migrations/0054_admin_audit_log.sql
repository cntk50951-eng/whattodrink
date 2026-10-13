-- 管理员审计日志（清單 D21：不可变审计；只追加，零 UPDATE/DELETE policy）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑。
-- 说明：每次查看敏感详情／判定／导出都落子（action＋target＋detail＋ip／ua）；
--   RLS 全 ENABLE 零 policy（service 读写；admin 读审计由后台页走 service，另议只读 viewer 角色）。

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action text NOT NULL,
  target text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  ua text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log (admin_id, at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target, at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
