-- UR I.3 账号注销（立即永久删除／30 天可恢复）。
-- Dashboard SQL Editor 贴上执行（可重放：IF NOT EXISTS）。成功标志："Success. No rows returned"，
-- Table Editor 见 account_deletions 空表。
-- 说明：
--   30 天可恢复＝申请时把「个人资料＋自己发的内容」存成 snapshot，立刻删掉实际数据（对所有人自动消失，
--   不用在 46 个路由里逐个加过滤）；恢复时回填。好友／聊天／碰杯／酒局不恢复（文案写明）。
--   立即永久删除不进此表（无快照、无痕）。
--   user_id 无 FK：users 行会被删，且表内只留 uuid＋快照，不留其他可识别字段；
--   到期（purge_at）由排程路由清文件＋登录账号，快照置空，行只留 purged 墓碑（uuid＋时间，无个资）。
--   RLS 全开零 policy＝默认全拒，只有 service_role 能读写。

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'grace' CHECK (status IN ('grace', 'purged')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  purge_at timestamptz NOT NULL,
  snapshot jsonb,
  purged_at timestamptz
);

CREATE INDEX IF NOT EXISTS account_deletions_purge_idx
  ON account_deletions (purge_at) WHERE status = 'grace';

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
