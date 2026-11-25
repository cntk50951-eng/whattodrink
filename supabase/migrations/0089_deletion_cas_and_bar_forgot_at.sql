-- 第十二輪審核 §3.1／§3.2：帳號刪除生命週期互斥狀態＋酒保記憶持久忘記時間戳（0089）。
-- 1) account_deletions.status 擴充為 ('grace', 'restoring', 'purging', 'purged')，
--    讓 restoreAccount 與 purgeExpired 在動資料前先原子 CAS 佔領狀態列，杜絕還原與重試／到期排程交錯誤刪。
-- 2) bar_memories 新增 forgot_at（墓碑復活時 deleted_at 置空，但 forgot_at 保留，持續阻擋早於忘記時間的離線 rev=0 寫入）。
-- 可重放：IF EXISTS / IF NOT EXISTS。
ALTER TABLE account_deletions DROP CONSTRAINT IF EXISTS account_deletions_status_check;
ALTER TABLE account_deletions
  ADD CONSTRAINT account_deletions_status_check
  CHECK (status IN ('grace', 'restoring', 'purging', 'purged'));

ALTER TABLE bar_memories ADD COLUMN IF NOT EXISTS forgot_at timestamptz;
UPDATE bar_memories
   SET forgot_at = deleted_at
 WHERE deleted_at IS NOT NULL
   AND forgot_at IS NULL;
