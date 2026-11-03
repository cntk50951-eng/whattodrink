-- 遇見「想找什麼」每日 AI 推薦語（iOS enhancement_nov2_01 #21）。
-- 平台級內容（不是個人化）：每天每種語言一行，由排程 /api/internal/meet-suggestions 用 service_role 寫入；
-- 客戶端只經 GET /api/v1/meet/suggestions 讀（走 service_role，不開放表給 anon／authenticated）。
-- 可重放：全 IF NOT EXISTS。Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。
--   day：香港日期；lang：zh-Hant｜zh-Hans｜en；items：[{id,text,icon}]；model：生成它的模型名（排查用）。

CREATE TABLE IF NOT EXISTS meet_suggestions (
  day date NOT NULL,
  lang text NOT NULL CHECK (lang IN ('zh-Hant', 'zh-Hans', 'en')),
  items jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, lang)
);

ALTER TABLE meet_suggestions ENABLE ROW LEVEL SECURITY;
-- 不建任何 policy：anon／authenticated 讀寫都被拒，只有 service_role（繞過 RLS）能碰。
CREATE INDEX IF NOT EXISTS meet_suggestions_lang_day_idx ON meet_suggestions (lang, day DESC);
