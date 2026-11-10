/*
# Create estimate_requests table

Stores contact-form submissions before the notification email is sent.
Visitors can insert. They cannot read, update, or delete rows.
*/

CREATE TABLE IF NOT EXISTS estimate_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  description text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_estimate_requests" ON estimate_requests;
CREATE POLICY "anon_insert_estimate_requests"
ON estimate_requests FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_estimate_requests" ON estimate_requests;
CREATE POLICY "authenticated_select_estimate_requests"
ON estimate_requests FOR SELECT
TO authenticated USING (true);
