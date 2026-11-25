-- 第十／十一輪審核 §3.4：舉報結果通知資料庫級唯一索引（0087）。
-- 目的：確保同一舉報（payload->>'report_id'）對同一收件人（user_id）與同一通知種類（kind）
--   在並發補發或回應丟失重試時最多只寫入一則通知；應用層遇 23505 視為已送達（冪等成功）。
-- 歷史資料升級保護（第十一輪 §3.4）：建唯一索引前先對既有重複行冪等去重（保留最早一筆），
--   確保線上已有重複紀錄時不會因 23505 中斷遷移。可重放。
DELETE FROM notifications
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, kind, (payload->>'report_id')
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM notifications
    WHERE kind IN ('post_actioned', 'report_actioned', 'report_resolved')
      AND payload ? 'report_id'
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_report_result_uniq
  ON notifications (user_id, kind, (payload->>'report_id'))
  WHERE kind IN ('post_actioned', 'report_actioned', 'report_resolved')
    AND payload ? 'report_id';
