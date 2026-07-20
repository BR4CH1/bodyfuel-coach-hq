DROP POLICY IF EXISTS "Bulls users read own progress photos" ON storage.objects;
CREATE POLICY "Bulls users read own progress photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_group(auth.uid(), 'bulls'::app_group)
);

DROP POLICY IF EXISTS "Users can update own bulls progress photos" ON storage.objects;
CREATE POLICY "Users can update own bulls progress photos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_group(auth.uid(), 'bulls'::app_group)
)
WITH CHECK (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_group(auth.uid(), 'bulls'::app_group)
);

DROP POLICY IF EXISTS "Bulls users delete own progress photos" ON storage.objects;
CREATE POLICY "Bulls users delete own progress photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'bulls-progress-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_group(auth.uid(), 'bulls'::app_group)
);