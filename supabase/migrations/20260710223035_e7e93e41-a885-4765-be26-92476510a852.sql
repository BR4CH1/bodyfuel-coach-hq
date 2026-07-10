
-- Bulls org constant used inline: 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c'

-- 0) Add is_rehab flag
ALTER TABLE public.athlete_training_session
  ADD COLUMN IF NOT EXISTS is_rehab boolean NOT NULL DEFAULT false;

-- 1) Fix bug in award_bulls_test_improvements: session_date -> test_date
CREATE OR REPLACE FUNCTION public.award_bulls_test_improvements(_session_id uuid, _user_id uuid, _organization_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_prev_val numeric;
  v_dir text;
  v_improved boolean;
  v_cap_pts int := 0;
  v_max_pts int := 30;
  v_event_date date;
  v_awarded int := 0;
BEGIN
  SELECT test_date INTO v_event_date FROM public.performance_test_sessions WHERE id = _session_id;
  IF v_event_date IS NULL THEN
    v_event_date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_cap_pts
  FROM public.bulls_ranking_events
  WHERE user_id = _user_id
    AND event_kind = 'test_pb_improvement'
    AND source_type = 'performance_test_attempt'
    AND status = 'active'
    AND metadata->>'session_id' = _session_id::text;

  FOR v_row IN
    SELECT a.id, a.test_definition_id, a.raw_value, d.direction, d.name
    FROM public.performance_test_attempts a
    JOIN public.performance_test_definitions d ON d.id = a.test_definition_id
    WHERE a.session_id = _session_id
      AND a.user_id = _user_id
      AND a.valid = true
      AND a.raw_value IS NOT NULL
  LOOP
    IF v_cap_pts >= v_max_pts THEN EXIT; END IF;
    v_dir := COALESCE(v_row.direction, 'higher');
    IF v_dir = 'lower' THEN
      SELECT MIN(a2.raw_value) INTO v_prev_val
      FROM public.performance_test_attempts a2
      JOIN public.performance_test_sessions s2 ON s2.id = a2.session_id
      WHERE a2.user_id = _user_id
        AND a2.test_definition_id = v_row.test_definition_id
        AND a2.valid = true AND a2.raw_value IS NOT NULL
        AND s2.id <> _session_id AND s2.test_date <= v_event_date;
      v_improved := v_prev_val IS NOT NULL AND v_row.raw_value < v_prev_val;
    ELSE
      SELECT MAX(a2.raw_value) INTO v_prev_val
      FROM public.performance_test_attempts a2
      JOIN public.performance_test_sessions s2 ON s2.id = a2.session_id
      WHERE a2.user_id = _user_id
        AND a2.test_definition_id = v_row.test_definition_id
        AND a2.valid = true AND a2.raw_value IS NOT NULL
        AND s2.id <> _session_id AND s2.test_date <= v_event_date;
      v_improved := v_prev_val IS NOT NULL AND v_row.raw_value > v_prev_val;
    END IF;

    IF v_improved THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.bulls_ranking_events
        WHERE user_id = _user_id AND event_kind = 'test_pb_improvement'
          AND source_type = 'performance_test_attempt' AND source_id = v_row.id
          AND status = 'active'
      ) THEN
        INSERT INTO public.bulls_ranking_events (
          user_id, organization_id, category, event_kind, points, event_date,
          source_type, source_id, reason, metadata
        ) VALUES (
          _user_id, _organization_id, 'development', 'test_pb_improvement', 10, v_event_date,
          'performance_test_attempt', v_row.id,
          'PB verbessert: ' || v_row.name,
          jsonb_build_object('test_definition_id', v_row.test_definition_id,
            'new_value', v_row.raw_value, 'prev_value', v_prev_val,
            'direction', v_dir, 'session_id', _session_id)
        );
        v_cap_pts := v_cap_pts + 10;
        v_awarded := v_awarded + 10;
      END IF;
    END IF;
  END LOOP;

  RETURN v_awarded;
END;
$function$;

-- 2) Nutrition day recompute helper
CREATE OR REPLACE FUNCTION public.recompute_bulls_nutrition_day(_user_id uuid, _organization_id uuid, _day date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kcal numeric := 0;
  v_prot numeric := 0;
  v_t_kcal integer;
  v_t_prot integer;
  v_has_entries boolean;
  v_within_kcal boolean;
  v_prot_ok boolean;
BEGIN
  SELECT COALESCE(SUM(kcal),0), COALESCE(SUM(protein_g),0),
         COUNT(*) > 0
    INTO v_kcal, v_prot, v_has_entries
  FROM public.food_entries
  WHERE user_id = _user_id AND entry_date = _day;

  SELECT kcal, protein_g INTO v_t_kcal, v_t_prot
  FROM public.nutrition_targets WHERE user_id = _user_id;

  -- Reversal if entries removed
  IF NOT v_has_entries THEN
    PERFORM public.reverse_bulls_points_by_source(_user_id, 'nutrition_day', NULL, 'nutrition_tracked', 'entries_removed');
    PERFORM public.reverse_bulls_points_by_source(_user_id, 'nutrition_day', NULL, 'nutrition_target_hit', 'entries_removed');
    RETURN;
  END IF;

  -- +5 tracked (idempotent per day via event_kind+event_date+source_id IS NULL is not applicable — we use synthetic source_id = day-derived deterministic uuid? Use unique per-day via source_id derived from date via md5)
  PERFORM public.award_bulls_points(
    _user_id, _organization_id, 'nutrition'::public.bulls_point_category,
    'nutrition_tracked', 5, _day,
    'nutrition_day', NULL, NULL, jsonb_build_object('day', _day), 'Ernährung getrackt', NULL, NULL
  );

  IF v_t_kcal IS NOT NULL AND v_t_kcal > 0 AND v_t_prot IS NOT NULL AND v_t_prot > 0 THEN
    v_within_kcal := abs(v_kcal - v_t_kcal) <= (v_t_kcal * 0.10);
    v_prot_ok := v_prot >= (v_t_prot * 0.90);
    IF v_within_kcal AND v_prot_ok THEN
      PERFORM public.award_bulls_points(
        _user_id, _organization_id, 'nutrition'::public.bulls_point_category,
        'nutrition_target_hit', 3, _day,
        'nutrition_day', NULL, NULL,
        jsonb_build_object('day', _day, 'kcal', v_kcal, 'target_kcal', v_t_kcal, 'protein_g', v_prot, 'target_protein_g', v_t_prot),
        'Ernährungsziel erreicht', NULL, NULL
      );
    ELSE
      PERFORM public.reverse_bulls_points_by_source(_user_id, 'nutrition_day', NULL, 'nutrition_target_hit', 'target_no_longer_met');
    END IF;
  END IF;

  PERFORM public.recompute_bulls_streak(_user_id, _organization_id);
END;
$function$;

-- 3) Trigger: Daily Check-in
CREATE OR REPLACE FUNCTION public.trg_bulls_checkin_award()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
BEGIN
  IF NEW.organization_id IS DISTINCT FROM v_bulls THEN
    IF EXISTS (SELECT 1 FROM public.organization_memberships
               WHERE user_id = NEW.user_id AND organization_id = v_bulls AND status = 'active') THEN
      NULL;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  PERFORM public.award_bulls_points(
    NEW.user_id, v_bulls, 'check_in'::public.bulls_point_category,
    'daily_checkin', 2, NEW.checkin_date,
    'athlete_checkin', NEW.id, NULL,
    jsonb_build_object('checkin_id', NEW.id), 'Daily Check-in', NULL, NULL
  );
  PERFORM public.recompute_bulls_streak(NEW.user_id, v_bulls);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_bulls_checkin_award ON public.athlete_checkins;
CREATE TRIGGER trg_bulls_checkin_award
AFTER INSERT ON public.athlete_checkins
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_checkin_award();

-- 4) Trigger: Training session completed
CREATE OR REPLACE FUNCTION public.trg_bulls_training_award()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  v_cat public.bulls_point_category;
  v_kind text;
  v_pts int;
BEGIN
  IF NEW.organization_id IS DISTINCT FROM v_bulls THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NEW.is_rehab THEN
      v_cat := 'rehab'; v_kind := 'rehab_completed'; v_pts := 8;
    ELSIF NEW.focus = 'mobility' THEN
      v_cat := 'recovery'; v_kind := 'recovery_completed'; v_pts := 4;
    ELSIF NEW.source_week_session_id IS NOT NULL THEN
      v_cat := 'team_training'; v_kind := 'team_training_completed'; v_pts := 12;
    ELSIF NEW.focus IN ('strength','speed','agility','conditioning') THEN
      v_cat := 'training'; v_kind := 'training_completed'; v_pts := 10;
    ELSE
      RETURN NEW;
    END IF;

    PERFORM public.award_bulls_points(
      NEW.user_id, v_bulls, v_cat, v_kind, v_pts, NEW.session_date,
      'athlete_training_session', NEW.id, NEW.team_id,
      jsonb_build_object('focus', NEW.focus, 'title', NEW.title, 'is_rehab', NEW.is_rehab),
      COALESCE(NEW.title, v_kind), NULL, NULL
    );
    PERFORM public.recompute_bulls_streak(NEW.user_id, v_bulls);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.reverse_bulls_points_by_source(NEW.user_id, 'athlete_training_session', NEW.id, NULL, 'training_uncompleted');
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_bulls_training_award ON public.athlete_training_session;
CREATE TRIGGER trg_bulls_training_award
AFTER UPDATE ON public.athlete_training_session
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_training_award();

-- 5) Trigger: Coach task completed
CREATE OR REPLACE FUNCTION public.trg_bulls_task_award()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
BEGIN
  IF NEW.organization_id IS DISTINCT FROM v_bulls THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.task_type IN ('daily_checkin','challenge','team_training','athletic_training') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.award_bulls_points(
      NEW.user_id, v_bulls, 'tasks'::public.bulls_point_category,
      'task_completed', 2, COALESCE(NEW.scheduled_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
      'organization_task', NEW.id, NEW.team_id,
      jsonb_build_object('task_type', NEW.task_type, 'title', NEW.title),
      COALESCE(NEW.title, 'Coach-Aufgabe'), NULL, 6
    );
    PERFORM public.recompute_bulls_streak(NEW.user_id, v_bulls);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.reverse_bulls_points_by_source(NEW.user_id, 'organization_task', NEW.id, 'task_completed', 'task_reopened');
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_bulls_task_award ON public.organization_tasks;
CREATE TRIGGER trg_bulls_task_award
AFTER UPDATE ON public.organization_tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_task_award();

-- 6) Trigger: Performance test attempts (session completion + PB)
CREATE OR REPLACE FUNCTION public.trg_bulls_test_attempt_award()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  v_org uuid; v_date date; v_team uuid;
BEGIN
  SELECT organization_id, test_date, team_id INTO v_org, v_date, v_team
  FROM public.performance_test_sessions WHERE id = NEW.session_id;
  IF v_org IS DISTINCT FROM v_bulls THEN RETURN NEW; END IF;
  IF NEW.valid IS NOT TRUE OR NEW.raw_value IS NULL THEN RETURN NEW; END IF;

  -- +20 pro Test-Session (idempotent via source_id=session)
  PERFORM public.award_bulls_points(
    NEW.user_id, v_bulls, 'development'::public.bulls_point_category,
    'test_session_completed', 20, COALESCE(v_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
    'performance_test_session', NEW.session_id, v_team,
    jsonb_build_object('session_id', NEW.session_id),
    'Performance-Test absolviert', NULL, NULL
  );

  -- +10 pro PB (cap 30/session)
  PERFORM public.award_bulls_test_improvements(NEW.session_id, NEW.user_id, v_bulls);
  PERFORM public.recompute_bulls_streak(NEW.user_id, v_bulls);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_bulls_test_attempt_award ON public.performance_test_attempts;
CREATE TRIGGER trg_bulls_test_attempt_award
AFTER INSERT ON public.performance_test_attempts
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_test_attempt_award();

-- 7) Trigger: Challenge point events -> mirror into bulls ledger
CREATE OR REPLACE FUNCTION public.trg_bulls_challenge_mirror()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
BEGIN
  IF NEW.organization_id IS DISTINCT FROM v_bulls THEN RETURN NEW; END IF;
  IF NEW.points IS NULL OR NEW.points = 0 THEN RETURN NEW; END IF;

  PERFORM public.award_bulls_points(
    NEW.user_id, v_bulls, 'challenge'::public.bulls_point_category,
    'challenge_event', NEW.points, NEW.event_date,
    'organization_challenge_point_event', NEW.id, NULL,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'rule_id', NEW.rule_id, 'source_type', NEW.source_type),
    'Challenge-Punkte gespiegelt', NEW.created_by, NULL
  );
  PERFORM public.recompute_bulls_streak(NEW.user_id, v_bulls);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_bulls_challenge_mirror ON public.organization_challenge_point_events;
CREATE TRIGGER trg_bulls_challenge_mirror
AFTER INSERT ON public.organization_challenge_point_events
FOR EACH ROW EXECUTE FUNCTION public.trg_bulls_challenge_mirror();
