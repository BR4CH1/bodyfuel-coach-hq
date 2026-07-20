-- 1) app_reviews: remove anon row-level access; rely on public_app_reviews view (now SECURITY DEFINER-style)
ALTER VIEW public.public_app_reviews SET (security_invoker = false);
DROP POLICY IF EXISTS "Anon can read published reviews safe columns" ON public.app_reviews;

-- 2) email_unsubscribe_tokens: belt-and-suspenders deny for anon/authenticated
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;

CREATE POLICY "deny_app_users"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);