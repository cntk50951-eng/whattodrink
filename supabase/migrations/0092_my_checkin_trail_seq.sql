-- 足跡全局序號（DEF-20261125-035）：時間軸分頁、足跡地圖、上一站／下一站用同一個「第 N 站」。
-- 序號＝本人全部足跡（主表＋未回流的歸檔，與 0088 同一篩選、同一 (created_at, id) 順序）由舊到新的 1-based 排名；
-- 不受視野／分頁影響。只對傳入的 id 回傳；total＝本人足跡總數。一次掃本人索引（checkins_my_trail_time_idx），有界。

CREATE OR REPLACE FUNCTION public.my_checkin_trail_seq(p_ids uuid[])
RETURNS TABLE (id uuid, seq bigint, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH all_rows AS (
    SELECT c.id, c.created_at
      FROM public.checkins c
      WHERE c.user_id = (SELECT auth.uid()) AND c.type = 'want'
        AND c.lat BETWEEN -90 AND 90 AND c.lng BETWEEN -180 AND 180
        AND isfinite(c.created_at)
    UNION ALL
    SELECT a.id, a.created_at
      FROM public.checkins_archive a
      WHERE a.user_id = (SELECT auth.uid()) AND a.type = 'want'
        AND a.lat BETWEEN -90 AND 90 AND a.lng BETWEEN -180 AND 180
        AND isfinite(a.created_at)
        AND NOT EXISTS (
          SELECT 1 FROM public.checkins active
          WHERE active.id = a.id AND active.user_id = a.user_id
        )
  ), ranked AS (
    SELECT r.id,
           row_number() OVER (ORDER BY r.created_at, r.id) AS seq,
           count(*) OVER () AS total
      FROM all_rows r
  )
  SELECT ranked.id, ranked.seq, ranked.total
    FROM ranked
    WHERE ranked.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.my_checkin_trail_seq(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_checkin_trail_seq(uuid[]) TO authenticated;
