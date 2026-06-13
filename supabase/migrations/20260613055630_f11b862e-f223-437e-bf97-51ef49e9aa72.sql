CREATE OR REPLACE FUNCTION public.recompute_user_points(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perf integer;
  v_daily integer;
  v_total integer;
  v_level integer;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_perf
  FROM public.performance_points
  WHERE user_id = _user_id AND approved = true;

  SELECT COALESCE(SUM(points), 0) INTO v_daily
  FROM public.daily_checks
  WHERE user_id = _user_id;

  v_daily := GREATEST(0, v_daily);
  v_total := v_daily + v_perf;
  v_level := GREATEST(1, 1 + (v_total / 100));

  INSERT INTO public.user_points (user_id, total_points, daily_points, performance_points, level)
  VALUES (_user_id, v_total, v_daily, v_perf, v_level)
  ON CONFLICT (user_id) DO UPDATE
  SET daily_points = EXCLUDED.daily_points,
      performance_points = EXCLUDED.performance_points,
      total_points = EXCLUDED.total_points,
      level = EXCLUDED.level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_user_points(uuid) FROM anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_points LOOP
    PERFORM public.recompute_user_points(r.user_id);
  END LOOP;
END $$;