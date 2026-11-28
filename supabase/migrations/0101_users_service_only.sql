-- DEF-20261128-003／004 完整修復。
-- ⚠️ 只能在「改用服務端讀寫 users 的 web 版本部署之後」執行；先執行會讓正式站讀不到用戶資料。
-- USER executes in Dashboard; never executed automatically by the app. Replayable.
-- 執行前提：下面的唯讀查詢除了 view | public | checkins_archive_detailed（0099 已收回授權）外沒有其他結果；有的話先處理。
--   select 'policy' as kind, schemaname||'.'||tablename as obj, policyname::text as name from pg_policies
--     where not (schemaname='public' and tablename='users') and (coalesce(qual,'') ~* '\musers\M' or coalesce(with_check,'') ~* '\musers\M')
--   union all select 'invoker function', n.nspname::text, p.proname::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and not p.prosecdef and p.prosrc ~* '\musers\M'
--   union all select distinct 'view', n.nspname::text, c.relname::text from pg_depend d join pg_rewrite r on r.oid=d.objid
--     join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace
--     where d.refobjid='public.users'::regclass and c.relkind in ('v','m')
--   order by 1,2,3;
-- 事務內自檢：權限不符合預期就整段回滾。執行後立刻打正式站地圖打卡釘、酒局清單，再用 App 改一次個人簡介。
-- 回退（回到執行前的授權）：
--   grant all on public.users to anon, authenticated;
--   notify pgrst, 'reload schema';
BEGIN;
REVOKE ALL ON public.users FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.guard_users_client_writes();
DO $$
BEGIN
  IF has_any_column_privilege('anon', 'public.users', 'select, insert, update') OR has_any_column_privilege('authenticated', 'public.users', 'select, insert, update')
     OR has_table_privilege('anon', 'public.users', 'delete') OR has_table_privilege('authenticated', 'public.users', 'delete') THEN
    RAISE EXCEPTION 'users: client roles still have access';
  END IF;
  IF NOT (has_table_privilege('service_role', 'public.users', 'select') AND has_table_privilege('service_role', 'public.users', 'insert')
          AND has_table_privilege('service_role', 'public.users', 'update') AND has_table_privilege('service_role', 'public.users', 'delete')) THEN
    RAISE EXCEPTION 'users: service_role lost access';
  END IF;
END $$;
COMMIT;
NOTIFY pgrst, 'reload schema';
