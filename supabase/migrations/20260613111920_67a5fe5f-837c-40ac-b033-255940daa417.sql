
-- Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- These are triggers or internal helpers that should never be called via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_daily_check() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pp_recompute_on_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_training_set() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_daily_check_points() FROM anon, authenticated, PUBLIC;

-- Keep has_role / has_group executable by authenticated since RLS policies reference them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_group(uuid, public.app_group) FROM anon, PUBLIC;
