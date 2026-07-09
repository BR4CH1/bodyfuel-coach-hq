
-- Coaches (global role) and org staff read avatars of athletes in their organizations
DROP POLICY IF EXISTS "avatars coach staff read" ON storage.objects;
CREATE POLICY "avatars coach staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      public.has_role(auth.uid(), 'coach'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.staff_assignments s
        JOIN public.organization_memberships m
          ON m.organization_id = s.organization_id
         AND m.status = 'active'
        WHERE s.user_id = auth.uid()
          AND m.user_id::text = (storage.foldername(name))[1]
      )
    )
  );
