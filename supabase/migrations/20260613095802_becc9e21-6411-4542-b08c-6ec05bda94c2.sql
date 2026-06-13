-- Trigger-only SECURITY DEFINER functions: revoke direct execute from clients
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_daily_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_daily_check_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pp_recompute_on_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_training_set() FROM PUBLIC, anon, authenticated;