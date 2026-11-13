GRANT SELECT (id, rating, comment, first_name, created_at, publish_with_name, approved_for_public, hidden) ON public.app_reviews TO anon;
ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public consented approved reviews" ON public.app_reviews FOR SELECT TO anon USING (publish_with_name = true AND approved_for_public = true AND hidden = false);
GRANT SELECT ON public.public_app_reviews TO anon, authenticated;
ALTER VIEW public.public_app_reviews SET (security_invoker = true);