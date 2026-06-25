
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;

CREATE POLICY "Service role can insert send log"
  ON public.email_send_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read send log"
  ON public.email_send_log
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update send log"
  ON public.email_send_log
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
