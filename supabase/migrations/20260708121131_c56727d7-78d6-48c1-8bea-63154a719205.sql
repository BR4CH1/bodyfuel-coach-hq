
DROP POLICY IF EXISTS "bpv_coach_select_all" ON storage.objects;

CREATE POLICY "bpv_coach_select_all" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'bulls-performance-videos'
  AND (
    public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_bulls_coach(auth.uid())
  )
);
