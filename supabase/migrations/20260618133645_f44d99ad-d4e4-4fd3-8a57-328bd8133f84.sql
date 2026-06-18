-- Allow free users to access bulls hub tables alongside bulls group members.
DROP POLICY IF EXISTS "Bulls users manage own events" ON public.bulls_hub_events;
CREATE POLICY "Bulls users manage own events" ON public.bulls_hub_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)))
  WITH CHECK (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)));

DROP POLICY IF EXISTS "Bulls users manage own profile" ON public.bulls_profiles;
CREATE POLICY "Bulls users manage own profile" ON public.bulls_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)))
  WITH CHECK (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)));

DROP POLICY IF EXISTS "Bulls users manage own photos" ON public.bulls_progress_photos;
CREATE POLICY "Bulls users manage own photos" ON public.bulls_progress_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)))
  WITH CHECK (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)));

DROP POLICY IF EXISTS "Bulls users manage own weight logs" ON public.bulls_weight_logs;
CREATE POLICY "Bulls users manage own weight logs" ON public.bulls_weight_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)))
  WITH CHECK (auth.uid() = user_id AND (public.has_group(auth.uid(), 'bulls'::app_group) OR public.has_role(auth.uid(), 'free'::app_role)));