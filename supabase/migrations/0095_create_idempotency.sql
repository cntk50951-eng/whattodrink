-- 0095 發酒局／發邀約冪等（iOS 外部審核 IOS-C04）。可重放。
-- 弱網連點、或服務端已建好但回包丟失後重試，以前會建出重複的酒局／邀約。
-- 客戶端每次「發佈嘗試」生成一個 client_request_id，重試沿用同一個；同一發起人＋同一 id 只會有一筆。
ALTER TABLE parties ADD COLUMN IF NOT EXISTS client_request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS parties_host_client_request_uq
  ON parties (host_user_id, client_request_id) WHERE client_request_id IS NOT NULL;
ALTER TABLE drink_invites ADD COLUMN IF NOT EXISTS client_request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS drink_invites_from_client_request_uq
  ON drink_invites (from_user_id, client_request_id) WHERE client_request_id IS NOT NULL;
