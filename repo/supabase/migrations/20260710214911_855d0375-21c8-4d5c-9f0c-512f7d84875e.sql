-- Tighten avatar visibility to shared team-level co-membership only
DROP POLICY IF EXISTS "avatars org co-member read" ON storage.objects;

CREATE POLICY "avatars team co-member read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1
    FROM public.team_memberships me
    JOIN public.team_memberships other
      ON other.team_id = me.team_id
     AND other.status = 'active'
    WHERE me.user_id = auth.uid()
      AND me.status = 'active'
      AND other.user_id::text = (storage.foldername(objects.name))[1]
  )
);

-- Restrict bulls performance video coach-read policy to authenticated role only
DROP POLICY IF EXISTS "bpv_coach_select_all" ON storage.objects;

CREATE POLICY "bpv_coach_select_all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'bulls-performance-videos'
  AND (has_role(auth.uid(), 'coach'::app_role) OR is_bulls_coach(auth.uid()))
);