-- 第十輪審核 §3.4：舉報結果通知資料庫級唯一索引（0087）。
-- 目的：確保同一舉報（payload->>'report_id'）對同一收件人（user_id）與同一通知種類（kind）
--   在並發補發或回應丟失重試時最多只寫入一則通知；應用層遇 23505 視為已送達（冪等成功）。
-- 可重放：IF NOT EXISTS。
CREATE UNIQUE INDEX IF NOT EXISTS notifications_report_result_uniq
  ON notifications (user_id, kind, (payload->>'report_id'))
  WHERE kind IN ('post_actioned', 'report_actioned', 'report_resolved')
    AND payload ? 'report_id';
