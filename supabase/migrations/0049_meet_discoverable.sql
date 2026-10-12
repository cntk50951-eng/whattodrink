-- 遇見 AI 找人（WEB_HANDOFF_MEET_AI）：被搜到同意＋每日搜索配额。
-- 可重放：IF NOT EXISTS。Dashboard 贴跑，成功 "Success. No rows returned"。
-- 说明：discoverable（null＝未问，true 才可被搜到；false／null 仍可搜别人）；
--   meet_search_date／meet_search_count（HK 自然日每日 10 次 LLM 搜索；criteria 重搜不计）；
--   RLS 无需动（读写走 service，路由限域）。

ALTER TABLE users ADD COLUMN IF NOT EXISTS discoverable boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meet_search_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meet_search_count integer NOT NULL DEFAULT 0;
