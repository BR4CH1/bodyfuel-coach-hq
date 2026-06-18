-- Restrict bulls tables back to the bulls group only.
DROP POLICY IF EXISTS "Bulls users manage own events" ON public.bulls_hub_events;
CREATE POLICY "Bulls users manage own events" ON public.bulls_hub_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group));

DROP POLICY IF EXISTS "Bulls users manage own profile" ON public.bulls_profiles;
CREATE POLICY "Bulls users manage own profile" ON public.bulls_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group));

DROP POLICY IF EXISTS "Bulls users manage own photos" ON public.bulls_progress_photos;
CREATE POLICY "Bulls users manage own photos" ON public.bulls_progress_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group));

DROP POLICY IF EXISTS "Bulls users manage own weight logs" ON public.bulls_weight_logs;
CREATE POLICY "Bulls users manage own weight logs" ON public.bulls_weight_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group))
  WITH CHECK (auth.uid() = user_id AND public.has_group(auth.uid(), 'bulls'::app_group));

-- Storage policies
DROP POLICY IF EXISTS "Bulls users read own progress photos" ON storage.objects;
CREATE POLICY "Bulls users read own progress photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bulls-progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_group(auth.uid(), 'bulls'::app_group)
  );

DROP POLICY IF EXISTS "Users can update own bulls progress photos" ON storage.objects;
CREATE POLICY "Users can update own bulls progress photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bulls-progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_group(auth.uid(), 'bulls'::app_group)
  );

DROP POLICY IF EXISTS "Bulls users delete own progress photos" ON storage.objects;
CREATE POLICY "Bulls users delete own progress photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bulls-progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_group(auth.uid(), 'bulls'::app_group)
  );

DROP POLICY IF EXISTS "Bulls users upload own progress photos" ON storage.objects;
CREATE POLICY "Bulls users upload own progress photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bulls-progress-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_group(auth.uid(), 'bulls'::app_group)
  );