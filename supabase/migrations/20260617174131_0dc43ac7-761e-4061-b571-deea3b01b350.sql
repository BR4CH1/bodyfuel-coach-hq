CREATE POLICY "progress-photos owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'coach'::app_role)
  ));

CREATE POLICY "progress-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "progress-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'coach'::app_role)
  ));