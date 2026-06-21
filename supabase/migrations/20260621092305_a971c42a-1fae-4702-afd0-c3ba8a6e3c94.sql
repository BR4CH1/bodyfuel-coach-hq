
-- 1) email_unsubscribe_tokens: restrict policies to service_role only
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;

CREATE POLICY "Service role can insert tokens"
  ON public.email_unsubscribe_tokens FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can mark tokens as used"
  ON public.email_unsubscribe_tokens FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can read tokens"
  ON public.email_unsubscribe_tokens FOR SELECT TO service_role USING (true);

REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;

-- 2) suppressed_emails: restrict policies to service_role only
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;

CREATE POLICY "Service role can insert suppressed emails"
  ON public.suppressed_emails FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails"
  ON public.suppressed_emails FOR SELECT TO service_role USING (true);

REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;

-- 3) Realtime: deny broadcast/presence subscriptions for all clients.
-- The app uses only postgres_changes (filtered by RLS on the source tables),
-- so no client needs direct realtime.messages access.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny broadcast and presence to clients" ON realtime.messages;
CREATE POLICY "Deny broadcast and presence to clients"
  ON realtime.messages
  FOR SELECT
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "Deny broadcast and presence writes" ON realtime.messages;
CREATE POLICY "Deny broadcast and presence writes"
  ON realtime.messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
