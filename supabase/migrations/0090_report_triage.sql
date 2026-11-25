-- 0090 舉報閉環：AI 置信度分流＋人工審核郵件（iOS DEF-20261125-020〜024，2026-11-25）
--
-- 每宗舉報先跑 AI 初審（OpenAI omni-moderation 分數；不可用時 Minimax 兜底）：
--   ai_decision = auto_actioned  高置信違規，系統直接處分（下架帖／扣誠信分／通知雙方）
--               = auto_dismissed 高置信無違規，系統結案並通知舉報人
--               = human          置信度不夠／AI 判斷不了的理由／服務不可用 → 人工審核＋郵件 support
-- ai_score      最高類別分數（0–1，只有 OpenAI 有；Minimax 兜底時為 NULL）
-- ai_route_reason  分流原因（給後台看：high_confidence／low_confidence／reason_needs_human／ai_unavailable／no_content）
-- support_emailed_at  已寄人工審核郵件的時間（先 CAS 佔位再寄，防重寄）
-- decision_note  結案說明（給舉報人「我的舉報」詳情看；不含 AI 分數）
--
-- 全部可為 NULL：舊案件與 0090 前的資料照常顯示；程式在欄位缺失（42703／PGRST204）時退回舊行為。

ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS ai_decision text;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS ai_score real;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS ai_categories text[];
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS ai_route_reason text;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS ai_checked_at timestamptz;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS support_emailed_at timestamptz;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS decision_note text;

ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_ai_decision_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_ai_decision_check
  CHECK (ai_decision IS NULL OR ai_decision IN ('auto_actioned', 'auto_dismissed', 'human'));

ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_ai_score_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_ai_score_check
  CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 1));

-- 「我的舉報」列表：按舉報人＋時間倒序翻頁
CREATE INDEX IF NOT EXISTS cheers_reports_reporter_idx ON cheers_reports (reporter_id, created_at DESC, id DESC);
