
-- 1) Restrict anon column access on app_reviews: never expose user_id
REVOKE SELECT ON public.app_reviews FROM anon;
GRANT SELECT (id, rating, comment, publish_with_name, first_name, approved_for_public, hidden, created_at, updated_at)
  ON public.app_reviews TO anon;

-- 2) Allow coaches to delete storage objects in bulls-progress-photos
DROP POLICY IF EXISTS "Coaches can delete bulls progress photos" ON storage.objects;
CREATE POLICY "Coaches can delete bulls progress photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bulls-progress-photos' AND public.has_role(auth.uid(), 'coach'::public.app_role));
