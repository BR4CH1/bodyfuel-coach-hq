
REVOKE EXECUTE ON FUNCTION public.compute_macro_targets(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_profile_goal_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_weight_recompute() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_macro_targets(uuid) TO service_role;
