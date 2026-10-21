-- 0065 附近的人：本次上線的起點。
-- 心跳窗（5 分鐘）斷開後重新上線才重置；窗內的連續心跳不動它。「最新上線」排序用，last_seen_at 每 30 秒都在變，不能用來排。
-- 可空：舊行／從沒上報的人為 NULL，讀端回退用 last_seen_at。
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_since timestamptz;
