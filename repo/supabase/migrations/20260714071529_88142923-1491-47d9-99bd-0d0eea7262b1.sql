-- Remove anon SELECT policy on base table; anonymous readers use public_app_reviews view instead.
DROP POLICY IF EXISTS "Anon can read published reviews safe columns" ON public.app_reviews;
REVOKE SELECT ON public.app_reviews FROM anon;

-- Ensure the safe view is reachable by anon (view uses security_invoker semantics via base RLS otherwise).
GRANT SELECT ON public.public_app_reviews TO anon, authenticated;