-- D.12 USER ACTION ONLY. Run after 0077 + backend deployment and Vault configuration.
-- In Supabase Dashboard: enable pg_cron, pg_net, Vault extensions first.
-- Vault UI secrets (never paste real values into a checked-in file):
-- push_dispatch_url = https://www.whattodrink.app/api/internal/push-dispatch
-- push_dispatch_secret = same >=16 character value as Vercel PUSH_DISPATCH_SECRET (legacy CRON_SECRET when dedicated value is unset)
-- Vault handles encryption; no service-role key is sent by pg_net.
CREATE OR REPLACE FUNCTION public.wake_native_push_dispatch()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE endpoint text; secret text; request_id bigint;
BEGIN
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='push_dispatch_url';
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='push_dispatch_secret';
 IF endpoint IS NULL OR endpoint !~ '^https://[a-zA-Z0-9.-]+/api/internal/push-dispatch$'
  OR secret IS NULL OR char_length(secret)<16 THEN RAISE EXCEPTION 'push cron configuration missing'; END IF;
 SELECT net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
  body:='{}'::jsonb,timeout_milliseconds:=55000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.wake_native_push_dispatch() FROM PUBLIC,anon,authenticated,service_role;
-- Replace our named job on re-run; leave unrelated Vercel/account/meet jobs untouched.
DO $$ DECLARE job bigint; BEGIN
 FOR job IN SELECT jobid FROM cron.job WHERE jobname='native-push-dispatch' LOOP PERFORM cron.unschedule(job); END LOOP;
END $$;
SELECT cron.schedule('native-push-dispatch','* * * * *','SELECT public.wake_native_push_dispatch();');
