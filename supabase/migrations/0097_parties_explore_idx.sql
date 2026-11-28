-- UR E.34：酒局「探索」按開始時間分頁（進行中升序／已結束降序）的索引。
-- USER executes in Dashboard; never executed automatically by the app. Additive, replayable.
CREATE INDEX IF NOT EXISTS parties_open_start_idx
  ON public.parties (start_at, id)
  WHERE status = 'open';
