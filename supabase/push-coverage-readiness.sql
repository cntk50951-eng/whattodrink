-- Read only; no secrets, no sends, no job/schema changes.
WITH expected(table_name, trigger_name) AS (VALUES
 ('notifications','enqueue_native_notice'), ('messages','enqueue_native_message'),
 ('drink_invites','enqueue_native_invite'), ('joins','native_join_notice'),
 ('complaints','native_complaint_notice'))
SELECT e.table_name,e.trigger_name,COALESCE(t.tgenabled IN ('O','A'),false) AS enabled
FROM expected e LEFT JOIN pg_trigger t
 ON t.tgname=e.trigger_name AND t.tgrelid=to_regclass('public.'||e.table_name)
 AND NOT t.tgisinternal ORDER BY e.table_name;

SELECT to_regprocedure('public.produce_native_push_reminders()') IS NOT NULL AS producer_ready,
 to_regprocedure('public.claim_native_push(integer)') IS NOT NULL AS claim_ready;
