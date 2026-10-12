-- 酒局目的＋发起人介绍（WEB_HANDOFF_PARTY_INTRO）。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：purposes（目的枚举数组）＋purpose_other（选 other 时自填）＋host_intro（发起人介绍）；
--   存量旧局全 null／{}，读端按"无"处理（iOS 隐藏）；RLS 无需动（parties 公开读沿旧）。

ALTER TABLE parties ADD COLUMN IF NOT EXISTS purposes text[] NOT NULL DEFAULT '{}';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS purpose_other text;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS host_intro text;
