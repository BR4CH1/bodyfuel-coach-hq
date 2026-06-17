
-- Drop the broad policy that exposed user_id to all authenticated users
DROP POLICY IF EXISTS "Authenticated can read published reviews" ON public.app_reviews;

-- Create a security_barrier view that only exposes safe columns of published reviews
CREATE OR REPLACE VIEW public.public_app_reviews
WITH (security_barrier = true, security_invoker = false) AS
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
