
-- 1) Remove client write paths on performance_points; only triggers (SECURITY DEFINER) and coaches may write.
DROP POLICY IF EXISTS "Users insert own performance points" ON public.performance_points;
DROP POLICY IF EXISTS "Users update own performance points" ON public.performance_points;
DROP POLICY IF EXISTS "Users delete own performance points" ON public.performance_points;

-- 2) user_roles: explicitly restrict writes to coach role only (RLS already denies by default,
--    but make the intent explicit so future permissive policies can't silently enable escalation).
DROP POLICY IF EXISTS "Coach manages roles" ON public.user_roles;
CREATE POLICY "Coach manages roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role));

-- 3) Lock down SECURITY DEFINER helpers that should never be callable by signed-in users.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_macro_targets(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM PUBLIC, anon, authenticated;
