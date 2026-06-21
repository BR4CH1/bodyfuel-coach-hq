-- Defense-in-depth: deny anon/authenticated access to suppressed_emails,
-- mirroring the deny_app_users policy on email_send_log.
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;

DROP POLICY IF EXISTS deny_app_users ON public.suppressed_emails;
CREATE POLICY deny_app_users ON public.suppressed_emails
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);