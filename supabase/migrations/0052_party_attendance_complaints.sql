-- 阶段 C1/C2 数据（WEB_HANDOFF_PARTY_COMPLAINT_C，UR E.31）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：
--   party_attendance（到场只存时间＋标记，不存坐标；outcome 由结算写）；
--   complaints（状态机＋申诉＋flags；唯一每局每对一次；filer<>target 由 CHECK 保证）；
--   party_reminders（提醒去重，PK 即幂等）；
--   admins（白名单，C2 后台用）；users 加 complaint_suspended_until；
--   RLS 全 ENABLE 零 policy（service 读写，沿 party_events）。
-- 提醒 job（pg_cron 纯 SQL，沿 0026 前例；5 分钟扫开局前 58–62min 的 open 局，
--   给发起人＋当前 joins 写 reminder_1h，party_reminders 去重；用户贴跑本文件后另起 cron job，见文件尾注释）。

CREATE TABLE IF NOT EXISTS party_attendance (
  party_id uuid NOT NULL REFERENCES parties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  arrived_at timestamptz,
  host_marked boolean,
  self_host_attended boolean,
  settled_at timestamptz,
  outcome text,
  PRIMARY KEY (party_id, user_id)
);
ALTER TABLE party_attendance ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES parties (id) ON DELETE CASCADE,
  filer_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('no_show','mismatch','harassment','safety','other')),
  detail text NOT NULL CHECK (char_length(detail) BETWEEN 1 AND 200),
  evidence jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_response','triaged','escalated','upheld','dismissed','malicious','withdrawn')),
  response_text text,
  responded_at timestamptz,
  response_due_at timestamptz,
  ai_json jsonb,
  ai_error text,
  decision text CHECK (decision IN ('uphold','dismiss','malicious')),
  decided_by text,
  decision_note text,
  decided_at timestamptz,
  appeal_text text,
  appeal_status text CHECK (appeal_status IN ('pending','upheld','dismissed')),
  appealed_at timestamptz,
  flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (party_id, filer_id, target_id),
  CHECK (filer_id <> target_id)
);
CREATE INDEX IF NOT EXISTS complaints_target_idx ON complaints (target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_filer_idx ON complaints (filer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS complaints_queue_idx ON complaints (status, created_at) WHERE status IN ('escalated','triaged');
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

ALTER TABLE users ADD COLUMN IF NOT EXISTS complaint_suspended_until timestamptz;

CREATE TABLE IF NOT EXISTS party_reminders (
  party_id uuid NOT NULL REFERENCES parties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'reminder_1h',
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id, kind)
);
ALTER TABLE party_reminders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 提醒扫表（用户另起 cron job；Supabase Dashboard → Database → Cron Jobs，
-- 每 5 分钟跑下面两句（先去重行，再通知；顺序不可反）：
-- 1) INSERT INTO party_reminders (party_id, user_id, kind)
--    SELECT p.id, m.user_id, 'reminder_1h'
--    FROM parties p
--    JOIN (SELECT host_user_id AS user_id, id AS party_id FROM parties WHERE status = 'open'
--          UNION SELECT j.user_id, j.party_id FROM joins j) m ON m.party_id = p.id
--    WHERE p.status = 'open'
--      AND p.start_at BETWEEN now() + interval '58 minutes' AND now() + interval '62 minutes'
--    ON CONFLICT DO NOTHING;
-- 2) INSERT INTO notifications (user_id, kind, party_id, payload)
--    SELECT r.user_id, 'reminder_1h', r.party_id,
--           jsonb_build_object('party_place', p.place, 'start_at', p.start_at)
--    FROM party_reminders r JOIN parties p ON p.id = r.party_id
--    WHERE r.kind = 'reminder_1h' AND r.sent_at > now() - interval '6 minutes'
--      AND NOT EXISTS (SELECT 1 FROM notifications n
--                      WHERE n.user_id = r.user_id AND n.party_id = r.party_id AND n.kind = 'reminder_1h');
-- （撤銷局 status 非 open 自动跳过；已退出者不在 joins 里；晚加入者在扫时仍在名单即收到。）
