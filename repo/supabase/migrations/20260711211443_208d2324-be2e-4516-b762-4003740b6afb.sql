-- Backfill der letzten 30 Tage für Coesfeld Bulls Ranking
DO $$
DECLARE
  v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  v_since date := ((now() AT TIME ZONE 'Europe/Berlin')::date - 30);
  r RECORD;
  v_cat public.bulls_point_category;
  v_kind text;
  v_pts int;
  v_users uuid[];
  u uuid;
  d date;
BEGIN
  -- 1) Daily Check-ins
  FOR r IN
    SELECT c.id, c.user_id, c.checkin_date
    FROM public.athlete_checkins c
    WHERE c.checkin_date >= v_since
      AND (
        c.organization_id = v_bulls
        OR EXISTS (SELECT 1 FROM public.organization_memberships m
                   WHERE m.user_id = c.user_id AND m.organization_id = v_bulls AND m.status = 'active')
      )
  LOOP
    PERFORM public.award_bulls_points(
      r.user_id, v_bulls, 'check_in'::public.bulls_point_category,
      'daily_checkin', 2, r.checkin_date,
      'athlete_checkin', r.id, NULL,
      jsonb_build_object('checkin_id', r.id, 'backfill', true),
      'Daily Check-in (Backfill)', NULL, NULL
    );
  END LOOP;

  -- 2) Completed Training Sessions
  FOR r IN
    SELECT s.id, s.user_id, s.session_date, s.team_id, s.focus, s.title, s.is_rehab, s.source_week_session_id
    FROM public.athlete_training_session s
    WHERE s.organization_id = v_bulls
      AND s.status = 'completed'
      AND s.session_date >= v_since
  LOOP
    IF r.is_rehab THEN
      v_cat := 'rehab'; v_kind := 'rehab_completed'; v_pts := 8;
    ELSIF r.focus = 'mobility' THEN
      v_cat := 'recovery'; v_kind := 'recovery_completed'; v_pts := 4;
    ELSIF r.source_week_session_id IS NOT NULL THEN
      v_cat := 'team_training'; v_kind := 'team_training_completed'; v_pts := 12;
    ELSIF r.focus IN ('strength','speed','agility','conditioning') THEN
      v_cat := 'training'; v_kind := 'training_completed'; v_pts := 10;
    ELSE
      CONTINUE;
    END IF;
    PERFORM public.award_bulls_points(
      r.user_id, v_bulls, v_cat, v_kind, v_pts, r.session_date,
      'athlete_training_session', r.id, r.team_id,
      jsonb_build_object('focus', r.focus, 'title', r.title, 'is_rehab', r.is_rehab, 'backfill', true),
      COALESCE(r.title, v_kind), NULL, NULL
    );
  END LOOP;

  -- 3) Completed Coach Tasks (kein daily_checkin/challenge/team_training/athletic_training)
  FOR r IN
    SELECT t.id, t.user_id, t.team_id, t.title, t.task_type, t.scheduled_date, t.updated_at
    FROM public.organization_tasks t
    WHERE t.organization_id = v_bulls
      AND t.status = 'completed'
      AND t.user_id IS NOT NULL
      AND t.task_type NOT IN ('daily_checkin','challenge','team_training','athletic_training')
      AND COALESCE(t.scheduled_date, t.updated_at::date) >= v_since
  LOOP
    PERFORM public.award_bulls_points(
      r.user_id, v_bulls, 'tasks'::public.bulls_point_category,
      'task_completed', 2, COALESCE(r.scheduled_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
      'organization_task', r.id, r.team_id,
      jsonb_build_object('task_type', r.task_type, 'title', r.title, 'backfill', true),
      COALESCE(r.title, 'Coach-Aufgabe'), NULL, 6
    );
  END LOOP;

  -- 4) Performance Test Attempts
  FOR r IN
    SELECT a.id, a.user_id, a.session_id, s.test_date, s.team_id
    FROM public.performance_test_attempts a
    JOIN public.performance_test_sessions s ON s.id = a.session_id
    WHERE s.organization_id = v_bulls
      AND a.valid IS TRUE
      AND a.raw_value IS NOT NULL
      AND COALESCE(s.test_date, a.created_at::date) >= v_since
  LOOP
    PERFORM public.award_bulls_points(
      r.user_id, v_bulls, 'development'::public.bulls_point_category,
      'test_session_completed', 20,
      COALESCE(r.test_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
      'performance_test_session', r.session_id, r.team_id,
      jsonb_build_object('session_id', r.session_id, 'backfill', true),
      'Performance-Test absolviert (Backfill)', NULL, NULL
    );
    PERFORM public.award_bulls_test_improvements(r.session_id, r.user_id, v_bulls);
  END LOOP;

  -- 5) Challenge point events spiegeln
  FOR r IN
    SELECT e.*
    FROM public.organization_challenge_point_events e
    WHERE e.organization_id = v_bulls
      AND COALESCE(e.points, 0) <> 0
      AND e.event_date >= v_since
  LOOP
    PERFORM public.award_bulls_points(
      r.user_id, v_bulls, 'challenge'::public.bulls_point_category,
      'challenge_event', r.points, r.event_date,
      'organization_challenge_point_event', r.id, NULL,
      jsonb_build_object('challenge_id', r.challenge_id, 'rule_id', r.rule_id,
                         'source_type', r.source_type, 'backfill', true),
      'Challenge-Punkte (Backfill)', r.created_by, NULL
    );
  END LOOP;

  -- 6) Nutrition Tage neu berechnen (pro User × Tag mit food_entries)
  FOR r IN
    SELECT DISTINCT fe.user_id, fe.entry_date::date AS d
    FROM public.food_entries fe
    WHERE fe.entry_date::date >= v_since
      AND EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id = fe.user_id AND m.organization_id = v_bulls AND m.status = 'active'
      )
  LOOP
    PERFORM public.recompute_bulls_nutrition_day(r.user_id, v_bulls, r.d);
  END LOOP;

  -- 7) Streaks pro Bulls-User einmal neu rechnen
  SELECT array_agg(DISTINCT user_id) INTO v_users
  FROM public.organization_memberships
  WHERE organization_id = v_bulls AND status = 'active';

  IF v_users IS NOT NULL THEN
    FOREACH u IN ARRAY v_users LOOP
      PERFORM public.recompute_bulls_streak(u, v_bulls);
    END LOOP;
  END IF;
END $$;