-- USER ACTION in the same Supabase project as cron job 6.
-- Set only the public dispatcher URL. Does not change any authentication secret or cron job.
DO $$
DECLARE
  url_secret_id uuid;
BEGIN
  SELECT id INTO url_secret_id
  FROM vault.secrets
  WHERE name = 'push_dispatch_url';

  IF url_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'https://www.whattodrink.app/api/internal/push-dispatch',
      'push_dispatch_url',
      'Production push dispatcher URL'
    );
  ELSE
    PERFORM vault.update_secret(
      url_secret_id,
      'https://www.whattodrink.app/api/internal/push-dispatch',
      'push_dispatch_url',
      'Production push dispatcher URL'
    );
  END IF;
END $$;
