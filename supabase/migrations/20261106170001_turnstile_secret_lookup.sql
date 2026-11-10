/*
# Turnstile secret lookup

The secret is stored in Vault outside this migration, under the name
TURNSTILE_SECRET_KEY. Only the edge function's service role can read it.
*/

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION public.get_turnstile_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = 'TURNSTILE_SECRET_KEY'
    LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_turnstile_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_turnstile_secret() TO service_role;
