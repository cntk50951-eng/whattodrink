-- 后台安全加固（审核报告 2026-10-13：H1–H4／M1／M2）。
-- 可重放：IF NOT EXISTS／DROP IF EXISTS／CREATE OR REPLACE。Dashboard SQL Editor 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   H4 审计不可变：去掉 admin_id→users 的级联外键（删号不再连审计一起删），
--      并用触发器在数据库层禁止 UPDATE／DELETE（service key 也拦；保留期清理需另走受控运维脚本，先 DISABLE TRIGGER）；
--   H3 内部备注与对外理由分栏：internal_note（仅后台）／public_reason（枚举 key，用户可见文案由代码映射）；
--      旧 decision_note 历史值并入 internal_note 后清空（用户 API 不再回该列）；
--   M1／H2 判定并发与改判：decision_lock_at（判定锁，2 分钟过期）＋decision_rev（改判版本，ref_id 带版本后缀）；
--   角色分级：admins.role（viewer 只读／moderator 可判定；导出与判定另要 TOTP 新鲜度，见代码）。

-- 1) 审计：去外键＋只追加。
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;

CREATE OR REPLACE FUNCTION admin_audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_no_mutation ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_mutation
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_append_only();

-- 2) 管理员角色。
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'moderator';
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check CHECK (role IN ('viewer', 'moderator'));

-- 3) 投诉：内部备注／对外理由／判定锁／改判版本。
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS internal_note text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS public_reason text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS decision_rev integer NOT NULL DEFAULT 0;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS decision_lock_at timestamptz;

UPDATE complaints SET internal_note = decision_note WHERE internal_note IS NULL AND decision_note IS NOT NULL;
UPDATE complaints SET decision_note = NULL WHERE decision_note IS NOT NULL;
