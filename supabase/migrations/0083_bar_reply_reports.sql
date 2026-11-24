-- 舉報酒保 Ivy 的回覆（Google Play AI 內容政策：App 內可舉報不當 AI 輸出）。
-- 可重放：語句均帶 IF NOT EXISTS。Supabase Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。
-- 只有服務端（service role）寫入與讀取；不開任何 RLS policy＝一般 key 全拒。

CREATE TABLE IF NOT EXISTS bar_reply_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users (id) ON DELETE SET NULL,
  reply_text text NOT NULL CHECK (char_length(reply_text) BETWEEN 1 AND 1000),
  user_text text NOT NULL DEFAULT '' CHECK (char_length(user_text) <= 500),
  reason text NOT NULL CHECK (reason IN ('sexual', 'minors', 'harassment', 'dangerous_drinking', 'self_harm', 'other')),
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'yue', 'zh')),
  platform text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios', 'aos', 'unknown')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bar_reply_reports_status_idx
  ON bar_reply_reports (status, created_at DESC);

ALTER TABLE bar_reply_reports ENABLE ROW LEVEL SECURITY;
