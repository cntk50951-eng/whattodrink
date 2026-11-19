-- 0078 發布冪等（C-01）
-- checkins.client_key：客戶端一次「發布」產生的 Idempotency-Key（UUID）。同一用戶同一個 key 只能有一則打卡，
-- 回包丟失後重送會命中既有那則（POST /api/v1/checkins 先查再插，並發重送靠這個唯一索引擋）。
-- 舊帖與沒帶 key 的舊客戶端為 NULL，部分索引不管 NULL。
-- 冪等；沒跑這條時 API 自動降級為沒有冪等（POST 查／插遇 42703 去掉 client_key，行為同現在）。
-- 歸檔任務（0026／0036c）的 INSERT … SELECT 都是顯式列清單，新增列不影響。
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS client_key text;

CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_client_key_uniq
  ON checkins (user_id, client_key)
  WHERE client_key IS NOT NULL;
