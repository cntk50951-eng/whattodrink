-- UR E.24 酒闻 batch：booze_news（新闻流；活动流二期不做）。
-- 可重放：IF NOT EXISTS＋DROP IF EXISTS 全套。
-- Dashboard SQL Editor 贴跑，成功标志 "Success. No rows returned"＋Table Editor 见空表。
-- 说明：
--   去重键 UNIQUE(source_url, region)（用户定案 2026-10-08）：H1 双 category（Hong Kong＋China）
--   存两行（hk＋cn 各一），交接原文单列 UNIQUE 会冲突故改复合；
--   H2 标题双关键词同样两行，都不含→both 一行；H1 无 category 默认 hk（HK 本地刊）。
--   写走 Edge Function service-role，不开写 policy；region 严格相等（hk 只回 hk，both 另查）。
--   Edge Function 首次部署＋挂每 2h cron＋首次触发均为用户 Dashboard 动作（见 backlog E.24）。

CREATE TABLE IF NOT EXISTS booze_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  snippet text NOT NULL DEFAULT '',
  source text NOT NULL,
  source_url text NOT NULL,
  image_url text,
  published_at timestamptz NOT NULL,
  region text NOT NULL DEFAULT 'hk' CHECK (region IN ('hk', 'cn', 'both')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, region)
);
CREATE INDEX IF NOT EXISTS booze_news_region_pub_idx
  ON booze_news (region, published_at DESC);

ALTER TABLE booze_news ENABLE ROW LEVEL SECURITY;

-- 全公开可读（酒闻公开流语义）；写走 service-role，不开写 policy。
DROP POLICY IF EXISTS "booze_news public read" ON booze_news;
CREATE POLICY "booze_news public read"
  ON booze_news FOR SELECT USING (true);
