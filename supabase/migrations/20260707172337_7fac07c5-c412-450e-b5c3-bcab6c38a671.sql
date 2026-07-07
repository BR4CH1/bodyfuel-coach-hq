
ALTER TABLE public.organization_community_posts
  ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Storage policies for community-photos
-- Path convention: <organization_id>/<user_id>/<uuid>.<ext>

DROP POLICY IF EXISTS "community photos read by org member" ON storage.objects;
CREATE POLICY "community photos read by org member" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'community-photos'
  AND (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id::text = (storage.foldername(name))[1]
    )
    OR public.has_role(auth.uid(), 'coach')
  )
);

DROP POLICY IF EXISTS "community photos insert own" ON storage.objects;
CREATE POLICY "community photos insert own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'community-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = auth.uid()
        AND sa.organization_id::text = (storage.foldername(name))[1]
    )
    OR public.has_role(auth.uid(), 'coach')
  )
);

DROP POLICY IF EXISTS "community photos update own" ON storage.objects;
CREATE POLICY "community photos update own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'community-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "community photos delete own" ON storage.objects;
CREATE POLICY "community photos delete own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'community-photos'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role(auth.uid(), 'coach')
  )
);
