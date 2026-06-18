
-- Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that are only meant to be triggered internally.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_daily_check() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_daily_check_points() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_profile_goal_recompute() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_strength_check() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_training_set() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pp_recompute_on_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.np_sync_is_active() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_macro_targets(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_weight_recompute() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_nutrition_plan_file_path() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- has_role, has_group, are_nutrition_partners, sc_score_for_test, sc_interp remain executable: they are referenced by RLS policies and computed fields and must be callable by authenticated/anon roles.
