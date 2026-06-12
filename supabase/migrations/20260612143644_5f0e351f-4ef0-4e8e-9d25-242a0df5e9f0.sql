
-- 1. user_points: remove user write access
DROP POLICY IF EXISTS "Users insert own points" ON public.user_points;
DROP POLICY IF EXISTS "Users update own points" ON public.user_points;

-- 2. user_achievements: remove user self-insert
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;

-- 3. storage objects: explicit UPDATE policy for nutrition-plans (coaches only)
DROP POLICY IF EXISTS "plan files: coach updates" ON storage.objects;
CREATE POLICY "plan files: coach updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'nutrition-plans' AND public.has_role(auth.uid(), 'coach'::public.app_role))
WITH CHECK (bucket_id = 'nutrition-plans' AND public.has_role(auth.uid(), 'coach'::public.app_role));

-- 4. leads: replace always-true INSERT policy with field validation
DROP POLICY IF EXISTS "anyone creates lead" ON public.leads;
CREATE POLICY "anyone creates lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(email) BETWEEN 3 AND 320
  AND email LIKE '%_@_%.__%'
);

-- 5. Lock down SECURITY DEFINER helpers from public/authenticated callers.
--    Triggers still execute fine — EXECUTE grants only affect direct RPC calls.
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_daily_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_training_set() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pp_recompute_on_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- 6. Pin search_path on email helper functions (linter: function_search_path_mutable)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;
