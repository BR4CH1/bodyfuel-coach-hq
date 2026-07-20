
CREATE POLICY "Users insert own performance points"
ON public.performance_points FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users update own performance points"
ON public.performance_points FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

CREATE POLICY "Users delete own performance points"
ON public.performance_points FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'));

REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_points FROM authenticated, anon;
