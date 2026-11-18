-- Read-only. Checks the same Vault names and URL rule used by wake_native_push_dispatch.
-- Returns booleans only: never select or paste decrypted secret values.
WITH config AS (
  SELECT
    max(decrypted_secret) FILTER (WHERE name = 'push_dispatch_url') AS endpoint,
    max(decrypted_secret) FILTER (WHERE name = 'push_dispatch_secret') AS token
  FROM vault.decrypted_secrets
  WHERE name IN ('push_dispatch_url', 'push_dispatch_secret')
)
SELECT
  endpoint IS NOT NULL AS url_exists,
  COALESCE(endpoint ~ '^https://[a-zA-Z0-9.-]+/api/internal/push-dispatch$', false) AS url_format_ok,
  COALESCE(endpoint = 'https://www.whattodrink.app/api/internal/push-dispatch', false) AS url_correct,
  token IS NOT NULL AS secret_exists,
  COALESCE(char_length(token) >= 16, false) AS secret_length_ok
FROM config;
