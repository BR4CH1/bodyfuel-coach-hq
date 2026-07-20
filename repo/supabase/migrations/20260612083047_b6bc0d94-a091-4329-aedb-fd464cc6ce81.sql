
ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS daily_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_points integer NOT NULL DEFAULT 0;

UPDATE public.user_points SET daily_points = total_points WHERE daily_points = 0 AND total_points > 0;

CREATE TABLE IF NOT EXISTS public.performance_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.training_exercises(id) ON DELETE SET NULL,
  exercise_name text,
  training_date date NOT NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  flagged boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_user_date_idx ON public.performance_points (user_id, training_date DESC);
CREATE INDEX IF NOT EXISTS pp_flagged_idx ON public.performance_points (flagged) WHERE flagged = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_points TO authenticated;
GRANT ALL ON public.performance_points TO service_role;

ALTER TABLE public.performance_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp read own or coach" ON public.performance_points;
CREATE POLICY "pp read own or coach" ON public.performance_points
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "pp coach update" ON public.performance_points;
CREATE POLICY "pp coach update" ON public.performance_points
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::app_role));

DROP POLICY IF EXISTS "pp coach delete" ON public.performance_points;
CREATE POLICY "pp coach delete" ON public.performance_points
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::app_role));

DROP TRIGGER IF EXISTS pp_updated_at ON public.performance_points;
CREATE TRIGGER pp_updated_at BEFORE UPDATE ON public.performance_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.recompute_user_points(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_perf integer; v_daily integer; v_total integer; v_level integer;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_perf FROM public.performance_points
  WHERE user_id = _user_id AND approved = true;
  SELECT daily_points INTO v_daily FROM public.user_points WHERE user_id = _user_id;
  v_daily := COALESCE(v_daily, 0);
  v_total := v_daily + v_perf;
  v_level := GREATEST(1, 1 + (v_total / 100));
  UPDATE public.user_points
  SET performance_points = v_perf, total_points = v_total, level = v_level
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_daily_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_points_diff integer; v_existing public.user_points%ROWTYPE;
  v_new_streak integer; v_new_daily integer; v_new_level integer;
  v_is_perfect boolean; v_perfect_week_count integer; ach RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN v_points_diff := NEW.points;
  ELSE v_points_diff := NEW.points - OLD.points; END IF;

  INSERT INTO public.user_points (user_id, total_points) VALUES (NEW.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_existing FROM public.user_points WHERE user_id = NEW.user_id FOR UPDATE;

  IF TG_OP = 'INSERT' THEN
    IF v_existing.last_check_date IS NULL THEN v_new_streak := 1;
    ELSIF NEW.check_date = v_existing.last_check_date + INTERVAL '1 day' THEN
      v_new_streak := v_existing.current_streak + 1;
    ELSIF NEW.check_date = v_existing.last_check_date THEN
      v_new_streak := GREATEST(v_existing.current_streak, 1);
    ELSE v_new_streak := 1; END IF;
  ELSE v_new_streak := v_existing.current_streak; END IF;

  v_new_daily := v_existing.daily_points + v_points_diff;
  UPDATE public.user_points
  SET daily_points = v_new_daily, current_streak = v_new_streak,
      longest_streak = GREATEST(longest_streak, v_new_streak),
      last_check_date = GREATEST(COALESCE(last_check_date, NEW.check_date), NEW.check_date)
  WHERE user_id = NEW.user_id;

  PERFORM public.recompute_user_points(NEW.user_id);

  v_is_perfect := NEW.points >= 15;
  SELECT COUNT(*) INTO v_perfect_week_count FROM public.daily_checks
  WHERE user_id = NEW.user_id AND check_date > NEW.check_date - INTERVAL '7 days'
    AND check_date <= NEW.check_date AND points >= 15;

  v_new_level := GREATEST(1, 1 + ((SELECT total_points FROM public.user_points WHERE user_id = NEW.user_id) / 100));

  FOR ach IN
    SELECT a.* FROM public.achievements a
    WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua
      WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id)
    AND ((a.trigger_type = 'first_check')
      OR (a.trigger_type = 'total_points' AND (SELECT total_points FROM public.user_points WHERE user_id = NEW.user_id) >= a.threshold)
      OR (a.trigger_type = 'streak' AND v_new_streak >= a.threshold)
      OR (a.trigger_type = 'level' AND v_new_level >= a.threshold)
      OR (a.trigger_type = 'perfect_day' AND v_is_perfect)
      OR (a.trigger_type = 'perfect_week' AND v_perfect_week_count >= 7))
  LOOP
    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (NEW.user_id, ach.id) ON CONFLICT DO NOTHING;
    IF ach.reward_points > 0 THEN
      UPDATE public.user_points SET daily_points = daily_points + ach.reward_points
      WHERE user_id = NEW.user_id;
      PERFORM public.recompute_user_points(NEW.user_id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_daily_check_trigger ON public.daily_checks;
CREATE TRIGGER process_daily_check_trigger
AFTER INSERT OR UPDATE ON public.daily_checks
FOR EACH ROW EXECUTE FUNCTION public.process_daily_check();

CREATE OR REPLACE FUNCTION public.process_training_set()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := NEW.client_id;
  v_date date := (NEW.performed_at AT TIME ZONE 'UTC')::date;
  v_ex_name text;
  v_w numeric := COALESCE(NEW.weight_kg, 0);
  v_r integer := COALESCE(NEW.reps, 0);
  v_today_best_w numeric; v_today_best_e numeric; v_today_best_reps integer; v_today_vol numeric;
  v_hist_best_w numeric; v_hist_best_e numeric; v_hist_best_reps integer; v_hist_best_vol numeric;
  v_last_date date; v_last_best_e numeric;
  v_pr_today integer; v_imp_today integer; v_perf_today integer; v_perf_week integer;
  v_streak_days integer; v_existing_kind boolean; v_is_flagged boolean;
BEGIN
  IF v_w <= 0 OR v_r <= 0 THEN RETURN NEW; END IF;

  SELECT name INTO v_ex_name FROM public.training_exercises WHERE id = NEW.exercise_id;

  SELECT MAX(weight_kg), MAX(weight_kg * (1 + reps::numeric/30)), MAX(reps), COALESCE(SUM(weight_kg*reps),0)
    INTO v_today_best_w, v_today_best_e, v_today_best_reps, v_today_vol
  FROM public.training_set_logs
  WHERE client_id = v_user AND exercise_id = NEW.exercise_id
    AND (performed_at AT TIME ZONE 'UTC')::date = v_date
    AND weight_kg IS NOT NULL AND reps IS NOT NULL;

  SELECT MAX(weight_kg), MAX(weight_kg * (1 + reps::numeric/30)), MAX(reps)
    INTO v_hist_best_w, v_hist_best_e, v_hist_best_reps
  FROM public.training_set_logs
  WHERE client_id = v_user AND exercise_id = NEW.exercise_id
    AND (performed_at AT TIME ZONE 'UTC')::date < v_date
    AND weight_kg IS NOT NULL AND reps IS NOT NULL;

  SELECT MAX(daily_vol) INTO v_hist_best_vol FROM (
    SELECT SUM(weight_kg*reps) AS daily_vol FROM public.training_set_logs
    WHERE client_id = v_user AND exercise_id = NEW.exercise_id
      AND (performed_at AT TIME ZONE 'UTC')::date < v_date
      AND weight_kg IS NOT NULL AND reps IS NOT NULL
    GROUP BY (performed_at AT TIME ZONE 'UTC')::date
  ) s;

  SELECT MAX((performed_at AT TIME ZONE 'UTC')::date) INTO v_last_date
  FROM public.training_set_logs
  WHERE client_id = v_user AND exercise_id = NEW.exercise_id
    AND (performed_at AT TIME ZONE 'UTC')::date < v_date;

  IF v_last_date IS NOT NULL THEN
    SELECT MAX(weight_kg * (1 + reps::numeric/30)) INTO v_last_best_e
    FROM public.training_set_logs
    WHERE client_id = v_user AND exercise_id = NEW.exercise_id
      AND (performed_at AT TIME ZONE 'UTC')::date = v_last_date
      AND weight_kg IS NOT NULL AND reps IS NOT NULL;
  END IF;

  SELECT COALESCE(SUM(points) FILTER (WHERE kind LIKE 'pr_%'), 0),
         COALESCE(SUM(points) FILTER (WHERE kind = 'improvement'), 0),
         COALESCE(SUM(points), 0)
    INTO v_pr_today, v_imp_today, v_perf_today
  FROM public.performance_points
  WHERE user_id = v_user AND training_date = v_date AND approved = true;

  SELECT COALESCE(SUM(points), 0) INTO v_perf_week
  FROM public.performance_points
  WHERE user_id = v_user AND training_date > v_date - INTERVAL '7 days'
    AND training_date <= v_date AND approved = true;

  -- pr_weight
  IF v_hist_best_w IS NULL OR v_today_best_w > v_hist_best_w THEN
    SELECT EXISTS(SELECT 1 FROM public.performance_points
      WHERE user_id=v_user AND training_date=v_date AND exercise_id=NEW.exercise_id AND kind='pr_weight')
      INTO v_existing_kind;
    IF NOT v_existing_kind AND v_pr_today + 2 <= 6 AND v_perf_today + 2 <= 10 AND v_perf_week + 2 <= 25 THEN
      v_is_flagged := (v_hist_best_w IS NOT NULL AND v_today_best_w > v_hist_best_w * 1.5);
      INSERT INTO public.performance_points(user_id, exercise_id, exercise_name, training_date, kind, points, details, flagged, approved)
      VALUES (v_user, NEW.exercise_id, v_ex_name, v_date, 'pr_weight', 2,
        jsonb_build_object('new', v_today_best_w, 'prev', v_hist_best_w), v_is_flagged, NOT v_is_flagged);
      IF NOT v_is_flagged THEN
        v_pr_today := v_pr_today + 2; v_perf_today := v_perf_today + 2; v_perf_week := v_perf_week + 2;
      END IF;
    END IF;
  END IF;

  -- pr_e1rm
  IF v_hist_best_e IS NULL OR v_today_best_e > v_hist_best_e THEN
    SELECT EXISTS(SELECT 1 FROM public.performance_points
      WHERE user_id=v_user AND training_date=v_date AND exercise_id=NEW.exercise_id AND kind='pr_e1rm')
      INTO v_existing_kind;
    IF NOT v_existing_kind AND v_pr_today + 2 <= 6 AND v_perf_today + 2 <= 10 AND v_perf_week + 2 <= 25 THEN
      v_is_flagged := (v_hist_best_e IS NOT NULL AND v_today_best_e > v_hist_best_e * 1.5);
      INSERT INTO public.performance_points(user_id, exercise_id, exercise_name, training_date, kind, points, details, flagged, approved)
      VALUES (v_user, NEW.exercise_id, v_ex_name, v_date, 'pr_e1rm', 2,
        jsonb_build_object('new', round(v_today_best_e,1), 'prev', round(COALESCE(v_hist_best_e,0),1)),
        v_is_flagged, NOT v_is_flagged);
      IF NOT v_is_flagged THEN
        v_pr_today := v_pr_today + 2; v_perf_today := v_perf_today + 2; v_perf_week := v_perf_week + 2;
      END IF;
    END IF;
  END IF;

  -- pr_volume
  IF v_hist_best_vol IS NULL OR v_today_vol > v_hist_best_vol THEN
    SELECT EXISTS(SELECT 1 FROM public.performance_points
      WHERE user_id=v_user AND training_date=v_date AND exercise_id=NEW.exercise_id AND kind='pr_volume')
      INTO v_existing_kind;
    IF NOT v_existing_kind AND v_pr_today + 2 <= 6 AND v_perf_today + 2 <= 10 AND v_perf_week + 2 <= 25 THEN
      INSERT INTO public.performance_points(user_id, exercise_id, exercise_name, training_date, kind, points, details, flagged, approved)
      VALUES (v_user, NEW.exercise_id, v_ex_name, v_date, 'pr_volume', 2,
        jsonb_build_object('new', round(v_today_vol,0), 'prev', round(COALESCE(v_hist_best_vol,0),0)), false, true);
      v_pr_today := v_pr_today + 2; v_perf_today := v_perf_today + 2; v_perf_week := v_perf_week + 2;
    END IF;
  END IF;

  -- pr_reps
  IF v_hist_best_reps IS NULL OR v_today_best_reps > v_hist_best_reps THEN
    SELECT EXISTS(SELECT 1 FROM public.performance_points
      WHERE user_id=v_user AND training_date=v_date AND exercise_id=NEW.exercise_id AND kind='pr_reps')
      INTO v_existing_kind;
    IF NOT v_existing_kind AND v_pr_today + 2 <= 6 AND v_perf_today + 2 <= 10 AND v_perf_week + 2 <= 25 THEN
      INSERT INTO public.performance_points(user_id, exercise_id, exercise_name, training_date, kind, points, details, flagged, approved)
      VALUES (v_user, NEW.exercise_id, v_ex_name, v_date, 'pr_reps', 2,
        jsonb_build_object('new', v_today_best_reps, 'prev', COALESCE(v_hist_best_reps,0)), false, true);
      v_pr_today := v_pr_today + 2; v_perf_today := v_perf_today + 2; v_perf_week := v_perf_week + 2;
    END IF;
  END IF;

  -- improvement
  IF v_last_best_e IS NOT NULL AND v_today_best_e > v_last_best_e
     AND (v_hist_best_e IS NULL OR v_today_best_e <= v_hist_best_e) THEN
    SELECT EXISTS(SELECT 1 FROM public.performance_points
      WHERE user_id=v_user AND training_date=v_date AND exercise_id=NEW.exercise_id AND kind='improvement')
      INTO v_existing_kind;
    IF NOT v_existing_kind AND v_imp_today + 1 <= 4 AND v_perf_today + 1 <= 10 AND v_perf_week + 1 <= 25 THEN
      INSERT INTO public.performance_points(user_id, exercise_id, exercise_name, training_date, kind, points, details, flagged, approved)
      VALUES (v_user, NEW.exercise_id, v_ex_name, v_date, 'improvement', 1,
        jsonb_build_object('new', round(v_today_best_e,1), 'last', round(v_last_best_e,1)), false, true);
      v_imp_today := v_imp_today + 1; v_perf_today := v_perf_today + 1; v_perf_week := v_perf_week + 1;
    END IF;
  END IF;

  -- streaks
  SELECT COUNT(DISTINCT (performed_at AT TIME ZONE 'UTC')::date) INTO v_streak_days
  FROM public.training_set_logs WHERE client_id = v_user;

  IF v_streak_days >= 7 AND NOT EXISTS(SELECT 1 FROM public.performance_points WHERE user_id=v_user AND kind='streak_7') THEN
    INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
    VALUES (v_user, v_date, 'streak_7', 5, jsonb_build_object('days', v_streak_days), true);
  END IF;

  IF v_streak_days >= 30 AND NOT EXISTS(SELECT 1 FROM public.performance_points WHERE user_id=v_user AND kind='streak_30') THEN
    INSERT INTO public.performance_points(user_id, training_date, kind, points, details, approved)
    VALUES (v_user, v_date, 'streak_30', 15, jsonb_build_object('days', v_streak_days), true);
  END IF;

  INSERT INTO public.user_points (user_id, total_points) VALUES (v_user, 0)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.recompute_user_points(v_user);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_training_set_trigger ON public.training_set_logs;
CREATE TRIGGER process_training_set_trigger
AFTER INSERT ON public.training_set_logs
FOR EACH ROW EXECUTE FUNCTION public.process_training_set();

CREATE OR REPLACE FUNCTION public.pp_recompute_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_user_points(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pp_recompute_trigger ON public.performance_points;
CREATE TRIGGER pp_recompute_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.performance_points
FOR EACH ROW EXECUTE FUNCTION public.pp_recompute_on_change();
