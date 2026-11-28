-- DEF-20261128-010／011：收回匿名與登入身分對歸檔視圖和高權限函數的授權。
-- USER executes in Dashboard; never executed automatically by the app. Replayable; 只改授權。
-- 原因：Supabase 默認把新函數和視圖直接授權給 anon／authenticated，舊遷移的 `REVOKE ... FROM PUBLIC` 收不掉。
-- 伺服器只用 service_role 呼叫這些函數；歸檔排程以函數擁有者身分執行。
BEGIN;

REVOKE ALL ON public.checkins_archive_detailed FROM anon, authenticated;

DO $$
DECLARE f record;
BEGIN
  -- 按 oid 逐個處理：線上版本的簽名可能與倉內不同（見 0061 註釋）
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND (p.proname LIKE 'bar\_credit\_%' OR p.proname = 'archive_expired_flash')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

COMMIT;
