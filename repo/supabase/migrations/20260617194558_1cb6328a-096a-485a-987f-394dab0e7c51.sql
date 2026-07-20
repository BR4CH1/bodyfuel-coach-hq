
-- Recreate view with security_invoker so it uses caller's RLS
DROP VIEW IF EXISTS public.public_app_reviews;
CREATE VIEW public.public_app_reviews
WITH (security_barrier = true, security_invoker = true) AS
SELECT
  id,
  rating,
  comment,
  first_name,
  created_at
FROM public.app_reviews
WHERE publish_with_name = true
  AND approved_for_public = true
  AND hidden = false;

GRANT SELECT ON public.public_app_reviews TO anon, authenticated;

-- Restrict anon to safe columns only on the underlying table
REVOKE ALL ON public.app_reviews FROM anon;
GRANT SELECT (id, rating, comment, first_name, created_at) ON public.app_reviews TO anon;

-- Permit anon row-level access only to published, approved, non-hidden reviews
CREATE POLICY "Anon can read published reviews safe columns"
  ON public.app_reviews
  FOR SELECT
  TO anon
  USING (publish_with_name = true AND approved_for_public = true AND hidden = false);
