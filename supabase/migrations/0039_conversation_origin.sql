-- UR D.10 陌生人消息：会话来源列（建会话依据；好友建即 friend）。
-- 可重放：IF NOT EXISTS。Dashboard SQL Editor 贴跑，成功 "Success. No rows returned"。
-- 说明：nullable 无回填（旧行 null，路由按 is_friend 派生 friend／direct）；RLS 零变更。

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origin text;
