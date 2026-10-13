-- 誠信積分賬本（WEB_HANDOFF_PARTY_TRUST_COMPLAINT 階段 B，UR E.30）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：trust_events 只追加（撤销用反向事件；分数现算，不做缓存列）；
--   唯一 (kind, ref_id) 保"同一事件只记一账"（调用方 ref 必填，null 不防重）；
--   RLS 全 ENABLE 零 policy（service 读写，沿 push_log）。

CREATE TABLE IF NOT EXISTS trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  delta integer NOT NULL,
  party_id uuid REFERENCES parties (id) ON DELETE CASCADE,
  ref_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + make_interval(days => 90),
  UNIQUE (kind, ref_id)
);
CREATE INDEX IF NOT EXISTS trust_events_user_idx ON trust_events (user_id, created_at DESC);
ALTER TABLE trust_events ENABLE ROW LEVEL SECURITY;
