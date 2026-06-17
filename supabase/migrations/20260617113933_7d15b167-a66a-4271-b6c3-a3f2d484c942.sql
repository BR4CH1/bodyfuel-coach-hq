-- user_achievements: explicit coach-only write policies (regular users have no write grant either)
CREATE POLICY "coach inserts achievements"
  ON public.user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "coach updates achievements"
  ON public.user_achievements
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "coach deletes achievements"
  ON public.user_achievements
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role));

-- user_points: explicit coach-only write policies
CREATE POLICY "coach inserts points"
  ON public.user_points
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "coach updates points"
  ON public.user_points
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

CREATE POLICY "coach deletes points"
  ON public.user_points
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role));