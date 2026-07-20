
ALTER FUNCTION public.sc_interp(numeric, numeric[]) SET search_path = public;
ALTER FUNCTION public.sc_score_for_test(public.strength_test_key, text, numeric, numeric, smallint) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.process_strength_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sc_interp(numeric, numeric[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sc_score_for_test(public.strength_test_key, text, numeric, numeric, smallint) FROM PUBLIC, anon, authenticated;
