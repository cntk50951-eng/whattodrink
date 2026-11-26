-- 酒局舉報（iOS DEF-20261126-006 ④／UR iOS-0.205；web＋iOS＋AOS）。
-- 在 cheers_reports 上擴 target_type＝party（target_ref＝parties.id，target_user_id＝發起人，服務端反查），
-- 新增兩個酒局專用原因碼：fake（虛假／詐騙）、dangerous（違法或危險）。
-- 酒局舉報一律人工；後台判「成立」時：未結束的局自動取消並通知成員，扣發起人誠信分。
-- 可重放：全 DROP IF EXISTS／IF NOT EXISTS。Dashboard SQL Editor 貼跑，成功標誌 "Success. No rows returned"。

ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_target_type_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_target_type_check
  CHECK (target_type IN ('user', 'post', 'message', 'party'));

ALTER TABLE cheers_reports DROP CONSTRAINT IF EXISTS cheers_reports_reason_code_check;
ALTER TABLE cheers_reports ADD CONSTRAINT cheers_reports_reason_code_check
  CHECK (reason_code IS NULL OR reason_code IN ('harassment', 'inappropriate', 'spam', 'underage', 'other', 'fake', 'dangerous'));

-- 同一人對同一酒局只能舉報一次（不限 24h）；部分唯一索引兜住並發重複提交
CREATE UNIQUE INDEX IF NOT EXISTS cheers_reports_party_once_idx
  ON cheers_reports (reporter_id, target_ref)
  WHERE target_type = 'party';
