/*
# Turnstile test-mode flag

value '1' skips verification. Default is off.
*/

CREATE TABLE IF NOT EXISTS private.turnstile_settings (
  name text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO private.turnstile_settings (name, value)
VALUES ('turnstile_test_mode', '0')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_turnstile_test_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.turnstile_settings
    WHERE name = 'turnstile_test_mode' AND value = '1'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_turnstile_test_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_turnstile_test_mode() TO service_role;
