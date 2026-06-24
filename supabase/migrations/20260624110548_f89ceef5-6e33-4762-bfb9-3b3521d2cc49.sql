-- Defense-in-depth: explicitly deny authenticated writes to subscriptions.
-- Subscription rows are managed by Stripe webhooks via service_role, which
-- bypasses RLS. These RESTRICTIVE policies ensure no authenticated client
-- can ever insert/update/delete subscription rows, even if a future
-- permissive policy is added by mistake.

DROP POLICY IF EXISTS "Deny authenticated insert on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny authenticated update on subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny authenticated delete on subscriptions" ON public.subscriptions;

CREATE POLICY "Deny authenticated insert on subscriptions"
ON public.subscriptions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny authenticated update on subscriptions"
ON public.subscriptions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated delete on subscriptions"
ON public.subscriptions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);