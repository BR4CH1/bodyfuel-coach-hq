-- Avatars bucket RLS: user manages own; org members can view co-members

-- Self manage (upload/update/delete own file inside user_id/ folder)
DROP POLICY IF EXISTS "avatars self read" ON storage.objects;
CREATE POLICY "avatars self read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars self write" ON storage.objects;
CREATE POLICY "avatars self write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars self update" ON storage.objects;
CREATE POLICY "avatars self update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars self delete" ON storage.objects;
CREATE POLICY "avatars self delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Org members read co-members' avatars: co-membership check via organization_memberships
DROP POLICY IF EXISTS "avatars org co-member read" ON storage.objects;
CREATE POLICY "avatars org co-member read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships me
      JOIN public.organization_memberships other
        ON other.organization_id = me.organization_id
       AND other.status = 'active'
      WHERE me.user_id = auth.uid()
        AND me.status = 'active'
        AND other.user_id::text = (storage.foldername(name))[1]
    )
  );
