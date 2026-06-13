CREATE OR REPLACE FUNCTION public.compute_daily_check_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer := 0;
  v_tasks jsonb := COALESCE(NEW.tasks, '{}'::jsonb);
BEGIN
  IF (v_tasks->>'protein')::boolean   IS TRUE THEN v_points := v_points + 3; END IF;
  IF (v_tasks->>'water')::boolean     IS TRUE THEN v_points := v_points + 2; END IF;
  IF (v_tasks->>'fruitsVeg')::boolean IS TRUE THEN v_points := v_points + 2; END IF;
  IF (v_tasks->>'steps')::boolean     IS TRUE THEN v_points := v_points + 2; END IF;
  IF (v_tasks->>'training')::boolean  IS TRUE THEN v_points := v_points + 3; END IF;
  IF (v_tasks->>'sleep')::boolean     IS TRUE THEN v_points := v_points + 2; END IF;
  IF (v_tasks->>'recovery')::boolean  IS TRUE THEN v_points := v_points + 1; END IF;
  NEW.points := v_points;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_daily_check_points ON public.daily_checks;
CREATE TRIGGER trg_compute_daily_check_points
BEFORE INSERT OR UPDATE ON public.daily_checks
FOR EACH ROW EXECUTE FUNCTION public.compute_daily_check_points();

REVOKE INSERT (points), UPDATE (points) ON public.daily_checks FROM authenticated, anon;