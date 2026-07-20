
DROP POLICY IF EXISTS "Anon can read published reviews safe columns" ON public.app_reviews;
REVOKE SELECT ON public.app_reviews FROM anon;
GRANT SELECT ON public.public_app_reviews TO anon;
