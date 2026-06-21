-- Revert view to security_invoker (linter friendly)
ALTER VIEW public.public_app_reviews SET (security_invoker = true);

-- Re-create anon row policy, but restrict columns via GRANT
CREATE POLICY "Anon can read published reviews safe columns"
ON public.app_reviews
FOR SELECT
TO anon
USING (publish_with_name = true AND approved_for_public = true AND hidden = false);

-- Column-level grants: anon can ONLY read non-sensitive columns (no user_id)
GRANT SELECT (id, rating, comment, first_name, created_at, publish_with_name, approved_for_public, hidden)
ON public.app_reviews TO anon;