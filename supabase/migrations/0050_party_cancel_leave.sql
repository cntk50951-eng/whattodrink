-- 酒局撤銷／退出記錄／站内通知階段 A（WEB_HANDOFF_PARTY_CANCEL_LEAVE）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   parties 加 cancelled_at（撤銷時間）＋cancel_reason（保留欄，本期 null）；
--   party_events（B 階段誠信計分依據：join／leave／leave_late／leave_after_start／
--     cancel／cancel_no_joiners＋joiners_count＋minutes_before_start）；
--   notifications（user 本人＋kind＋party／actor 引用＋payload＋read_at；
--     本期 kind：party_cancelled／member_left／member_left_late）；
--   RLS 全 ENABLE 零 policy（service 读写，沿 push_log；读端路由限域本人）。

ALTER TABLE parties ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE TABLE IF NOT EXISTS party_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES parties (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  kind text NOT NULL,
  joiners_count integer NOT NULL DEFAULT 0,
  minutes_before_start integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_events_party_idx ON party_events (party_id, created_at DESC);
ALTER TABLE party_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  party_id uuid REFERENCES parties (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
