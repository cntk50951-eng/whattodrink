-- 用戶／帖子／聊天訊息舉報進審核隊列（iOS 上架 Apple 1.2：舉報要有人處理）。
-- 在 0022 的 cheers_reports 上擴欄，不新開表；舊行補默認值，舊客戶端（只傳 target_user_id＋reason）照常可用。
-- 可重放：全 IF NOT EXISTS／DROP IF EXISTS。Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。
--   target_type：user＝舉報人本身（舊行默認）；post＝打卡帖（target_ref＝checkins.id）；message＝聊天訊息（target_ref＝messages.id）。
--   target_user_id：被舉報的作者（post／message 由服務端按目標反查，不信客戶端）。
--   snapshot：舉報當下的證據（訊息／帖子文字），帖子或訊息之後被刪也在。已處理 7 天後由後台懶清。
--   status：pending → reviewed／actioned／dismissed（同 game_reports 口徑）。

ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'user';
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS target_ref text;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS snapshot jsonb;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE cheers_reports ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_target_type_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_target_type_check
  CHECK (target_type IN ('user', 'post', 'message'));
ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_status_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_status_check
  CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed'));
ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_reason_code_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_reason_code_check
  CHECK (reason_code IS NULL OR reason_code IN ('harassment', 'inappropriate', 'spam', 'underage', 'other'));

CREATE INDEX IF NOT EXISTS cheers_reports_queue_idx ON cheers_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS cheers_reports_dedupe_idx
  ON cheers_reports (reporter_id, target_type, target_user_id, created_at DESC);

-- 舉報人只能插「待處理」的行：不許自己把 status／decided_* 寫成已處理（客戶端帶 JWT 直連 PostgREST 也一樣）。
DROP POLICY IF EXISTS "cheers_reports own insert" ON cheers_reports;
CREATE POLICY "cheers_reports own insert"
  ON cheers_reports FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND status = 'pending'
    AND decided_by IS NULL
    AND decided_at IS NULL
  );
