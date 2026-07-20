
-- 1) Tighten nutrition-plans storage SELECT: require a matching nutrition_plans row
DROP POLICY IF EXISTS "plan files: clients read own" ON storage.objects;
CREATE POLICY "plan files: clients read own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'nutrition-plans'
  AND (
    has_role(auth.uid(), 'coach'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.nutrition_plans np
      WHERE np.client_id = auth.uid()
        AND np.file_path = storage.objects.name
    )
  )
);

-- 2) Revoke EXECUTE on internal/trigger SECURITY DEFINER functions from public roles.
-- Keep RLS helpers (has_role, has_group, are_nutrition_partners) callable by authenticated,
-- because RLS policies invoke them in the caller's context.

-- Trigger functions (only fire via triggers; no need for direct RPC)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_daily_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_daily_check_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_strength_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_training_set() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pp_recompute_on_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_profile_goal_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_weight_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.np_sync_is_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_nutrition_plan_file_path() FROM PUBLIC, anon, authenticated;

-- Internal computations
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_macro_targets(uuid) FROM PUBLIC, anon, authenticated;

-- Email queue helpers (only invoked by server-side service role / edge functions)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
