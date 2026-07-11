
-- ============================================================
-- Generic Organization Ranking Engine
-- Mirrors the Bulls system for every non-Bulls organization.
-- Bulls (b86f49ab-20b7-42ca-bba4-f65ca8757c4c) keeps its own ledger.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_point_category') THEN
    CREATE TYPE public.org_point_category AS ENUM (
      'training', 'team_training', 'nutrition', 'check_in', 'tasks',
      'recovery', 'rehab', 'development', 'challenge', 'streak'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.org_ranking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  team_id uuid,
  category public.org_point_category NOT NULL,
  event_kind text NOT NULL,
  points integer NOT NULL,
  event_date date NOT NULL,
  source_type text,
  source_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reversed')),
  reversed_by_event_id uuid REFERENCES public.org_ranking_events(id) ON DELETE SET NULL,
  reason text,
  awarded_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_events_source_uidx
  ON public.org_ranking_events (organization_id, user_id, event_kind, source_type, source_id)
  WHERE source_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS org_events_daily_uidx
  ON public.org_ranking_events (organization_id, user_id, event_kind, event_date)
  WHERE source_id IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS org_events_org_date_idx
  ON public.org_ranking_events (organization_id, event_date DESC);
CREATE INDEX IF NOT EXISTS org_events_user_date_idx
  ON public.org_ranking_events (user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS org_events_category_idx
  ON public.org_ranking_events (organization_id, category, event_date DESC);

GRANT SELECT ON public.org_ranking_events TO authenticated;
GRANT ALL ON public.org_ranking_events TO service_role;

ALTER TABLE public.org_ranking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_events_own_select ON public.org_ranking_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY org_events_org_member_select ON public.org_ranking_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY org_events_staff_select ON public.org_ranking_events
  FOR SELECT TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id, NULL));
CREATE POLICY org_events_no_client_insert ON public.org_ranking_events
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY org_events_no_client_update ON public.org_ranking_events
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY org_events_no_client_delete ON public.org_ranking_events
  FOR DELETE TO authenticated USING (false);

DROP TRIGGER IF EXISTS org_events_touch ON public.org_ranking_events;
CREATE TRIGGER org_events_touch
  BEFORE UPDATE ON public.org_ranking_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Constant helper: is this the Bulls org (skip in generic engine)?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_bulls_org(_org_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _org_id = 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c'::uuid;
$$;

-- ============================================================
-- Core: award_org_points (idempotent, optional daily cap)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_org_points(
  _user_id uuid,
  _organization_id uuid,
  _category public.org_point_category,
  _event_kind text,
  _points integer,
  _event_date date,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _team_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _reason text DEFAULT NULL,
  _awarded_by uuid DEFAULT NULL,
  _daily_cap integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_existing uuid; v_day_sum integer; v_effective integer := _points;
BEGIN
  IF _user_id IS NULL OR _organization_id IS NULL OR _event_kind IS NULL THEN
    RAISE EXCEPTION 'award_org_points: required args missing';
  END IF;

  IF _source_id IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.org_ranking_events
    WHERE organization_id = _organization_id AND user_id = _user_id
      AND event_kind = _event_kind
      AND source_type IS NOT DISTINCT FROM _source_type
      AND source_id = _source_id AND status = 'active' LIMIT 1;
  ELSE
    SELECT id INTO v_existing FROM public.org_ranking_events
    WHERE organization_id = _organization_id AND user_id = _user_id
      AND event_kind = _event_kind AND event_date = _event_date
      AND source_id IS NULL AND status = 'active' LIMIT 1;
  END IF;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  IF _daily_cap IS NOT NULL THEN
    SELECT COALESCE(SUM(points),0) INTO v_day_sum
    FROM public.org_ranking_events
    WHERE organization_id = _organization_id AND user_id = _user_id
      AND event_kind = _event_kind AND event_date = _event_date AND status = 'active';
    IF v_day_sum >= _daily_cap THEN RETURN NULL; END IF;
    IF v_day_sum + _points > _daily_cap THEN
      v_effective := _daily_cap - v_day_sum;
      IF v_effective <= 0 THEN RETURN NULL; END IF;
    END IF;
  END IF;

  INSERT INTO public.org_ranking_events (
    user_id, organization_id, team_id, category, event_kind, points,
    event_date, source_type, source_id, reason, awarded_by, metadata
  ) VALUES (
    _user_id, _organization_id, _team_id, _category, _event_kind, v_effective,
    _event_date, _source_type, _source_id, _reason, _awarded_by,
    COALESCE(_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.award_org_points(uuid, uuid, public.org_point_category, text, integer, date, text, uuid, uuid, jsonb, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_org_points(uuid, uuid, public.org_point_category, text, integer, date, text, uuid, uuid, jsonb, text, uuid, integer) TO service_role;

-- ============================================================
-- reverse_org_points_by_source
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_org_points_by_source(
  _organization_id uuid, _user_id uuid, _source_type text, _source_id uuid,
  _event_kind text DEFAULT NULL, _reason text DEFAULT 'activity_reverted'
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row RECORD; v_count int := 0; v_rev uuid;
BEGIN
  FOR v_row IN
    SELECT * FROM public.org_ranking_events
    WHERE organization_id = _organization_id AND user_id = _user_id
      AND source_type = _source_type
      AND (_source_id IS NULL OR source_id = _source_id)
      AND status = 'active'
      AND (_event_kind IS NULL OR event_kind = _event_kind)
  LOOP
    INSERT INTO public.org_ranking_events (
      user_id, organization_id, team_id, category, event_kind, points,
      event_date, source_type, source_id, status, reversed_by_event_id, reason, metadata
    ) VALUES (
      v_row.user_id, v_row.organization_id, v_row.team_id, v_row.category,
      v_row.event_kind || '_reversal', -v_row.points, v_row.event_date,
      v_row.source_type, v_row.source_id, 'reversed', v_row.id, _reason,
      jsonb_build_object('original_event_id', v_row.id)
    ) RETURNING id INTO v_rev;
    UPDATE public.org_ranking_events
      SET status = 'reversed', reversed_by_event_id = v_rev, updated_at = now()
    WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.reverse_org_points_by_source(uuid, uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_org_points_by_source(uuid, uuid, text, uuid, text, text) TO service_role;

-- ============================================================
-- recompute_org_streak
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_org_streak(_user_id uuid, _organization_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_streak int := 0; v_start date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_check date; v_has boolean;
  v_ms int[] := ARRAY[3,7,14,30];
  v_rw int[] := ARRAY[5,15,30,75];
  v_i int; v_m int; v_pts int; v_already boolean;
BEGIN
  v_check := v_today;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.org_ranking_events
      WHERE organization_id = _organization_id AND user_id = _user_id
        AND event_date = v_check AND category <> 'streak' AND status = 'active'
    ) INTO v_has;
    IF NOT v_has THEN EXIT; END IF;
    v_streak := v_streak + 1; v_start := v_check; v_check := v_check - 1;
  END LOOP;
  IF v_streak = 0 THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_ms,1) LOOP
    v_m := v_ms[v_i]; v_pts := v_rw[v_i];
    IF v_streak >= v_m THEN
      SELECT EXISTS (
        SELECT 1 FROM public.org_ranking_events
        WHERE organization_id = _organization_id AND user_id = _user_id
          AND event_kind = 'streak_'||v_m
          AND source_type = 'streak_run'
          AND metadata->>'streak_start' = v_start::text
          AND status = 'active'
      ) INTO v_already;
      IF NOT v_already THEN
        INSERT INTO public.org_ranking_events (
          user_id, organization_id, category, event_kind, points, event_date,
          source_type, metadata, reason
        ) VALUES (
          _user_id, _organization_id, 'streak', 'streak_'||v_m, v_pts, v_today,
          'streak_run',
          jsonb_build_object('streak_start', v_start, 'days', v_streak),
          v_m||' aktive Tage in Folge'
        );
      END IF;
    END IF;
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.recompute_org_streak(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_org_streak(uuid, uuid) TO service_role;

-- ============================================================
-- award_org_test_improvements
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_org_test_improvements(
  _session_id uuid, _user_id uuid, _organization_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD; v_prev numeric; v_dir text; v_improved boolean;
  v_cap int := 0; v_max int := 30; v_date date; v_awarded int := 0;
BEGIN
  SELECT test_date INTO v_date FROM public.performance_test_sessions WHERE id = _session_id;
  IF v_date IS NULL THEN v_date := (now() AT TIME ZONE 'Europe/Berlin')::date; END IF;

  SELECT COALESCE(SUM(points),0) INTO v_cap
  FROM public.org_ranking_events
  WHERE organization_id = _organization_id AND user_id = _user_id
    AND event_kind = 'test_pb_improvement' AND source_type = 'performance_test_attempt'
    AND status = 'active' AND metadata->>'session_id' = _session_id::text;

  FOR v_row IN
    SELECT a.id, a.test_definition_id, a.raw_value, d.direction, d.name
    FROM public.performance_test_attempts a
    JOIN public.performance_test_definitions d ON d.id = a.test_definition_id
    WHERE a.session_id = _session_id AND a.user_id = _user_id
      AND a.valid = true AND a.raw_value IS NOT NULL
  LOOP
    IF v_cap >= v_max THEN EXIT; END IF;
    v_dir := COALESCE(v_row.direction,'higher');
    IF v_dir = 'lower' THEN
      SELECT MIN(a2.raw_value) INTO v_prev FROM public.performance_test_attempts a2
      JOIN public.performance_test_sessions s2 ON s2.id = a2.session_id
      WHERE a2.user_id=_user_id AND a2.test_definition_id=v_row.test_definition_id
        AND a2.valid=true AND a2.raw_value IS NOT NULL
        AND s2.id<>_session_id AND s2.test_date<=v_date;
      v_improved := v_prev IS NOT NULL AND v_row.raw_value < v_prev;
    ELSE
      SELECT MAX(a2.raw_value) INTO v_prev FROM public.performance_test_attempts a2
      JOIN public.performance_test_sessions s2 ON s2.id = a2.session_id
      WHERE a2.user_id=_user_id AND a2.test_definition_id=v_row.test_definition_id
        AND a2.valid=true AND a2.raw_value IS NOT NULL
        AND s2.id<>_session_id AND s2.test_date<=v_date;
      v_improved := v_prev IS NOT NULL AND v_row.raw_value > v_prev;
    END IF;

    IF v_improved AND NOT EXISTS (
      SELECT 1 FROM public.org_ranking_events
      WHERE organization_id=_organization_id AND user_id=_user_id
        AND event_kind='test_pb_improvement' AND source_type='performance_test_attempt'
        AND source_id=v_row.id AND status='active'
    ) THEN
      INSERT INTO public.org_ranking_events (
        user_id, organization_id, category, event_kind, points, event_date,
        source_type, source_id, reason, metadata
      ) VALUES (
        _user_id, _organization_id, 'development', 'test_pb_improvement', 10, v_date,
        'performance_test_attempt', v_row.id, 'PB verbessert: '||v_row.name,
        jsonb_build_object('test_definition_id', v_row.test_definition_id,
          'new_value', v_row.raw_value, 'prev_value', v_prev,
          'direction', v_dir, 'session_id', _session_id)
      );
      v_cap := v_cap + 10; v_awarded := v_awarded + 10;
    END IF;
  END LOOP;
  RETURN v_awarded;
END; $$;

REVOKE ALL ON FUNCTION public.award_org_test_improvements(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_org_test_improvements(uuid, uuid, uuid) TO service_role;

-- ============================================================
-- recompute_org_nutrition_day
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_org_nutrition_day(
  _user_id uuid, _organization_id uuid, _day date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kcal numeric := 0; v_prot numeric := 0;
  v_t_kcal int; v_t_prot int; v_has boolean;
  v_within boolean; v_prot_ok boolean;
BEGIN
  SELECT COALESCE(SUM(kcal),0), COALESCE(SUM(protein_g),0), COUNT(*)>0
    INTO v_kcal, v_prot, v_has
  FROM public.food_entries
  WHERE user_id = _user_id AND entry_date = _day;

  SELECT kcal, protein_g INTO v_t_kcal, v_t_prot
  FROM public.nutrition_targets WHERE user_id = _user_id;

  IF NOT v_has THEN
    PERFORM public.reverse_org_points_by_source(_organization_id, _user_id, 'nutrition_day', NULL, 'nutrition_tracked', 'entries_removed');
    PERFORM public.reverse_org_points_by_source(_organization_id, _user_id, 'nutrition_day', NULL, 'nutrition_target_hit', 'entries_removed');
    RETURN;
  END IF;

  PERFORM public.award_org_points(
    _user_id, _organization_id, 'nutrition'::public.org_point_category,
    'nutrition_tracked', 5, _day, 'nutrition_day', NULL, NULL,
    jsonb_build_object('day', _day), 'Ernährung getrackt', NULL, NULL
  );

  IF v_t_kcal IS NOT NULL AND v_t_kcal > 0 AND v_t_prot IS NOT NULL AND v_t_prot > 0 THEN
    v_within := abs(v_kcal - v_t_kcal) <= (v_t_kcal * 0.10);
    v_prot_ok := v_prot >= (v_t_prot * 0.90);
    IF v_within AND v_prot_ok THEN
      PERFORM public.award_org_points(
        _user_id, _organization_id, 'nutrition'::public.org_point_category,
        'nutrition_target_hit', 3, _day, 'nutrition_day', NULL, NULL,
        jsonb_build_object('day', _day, 'kcal', v_kcal, 'target_kcal', v_t_kcal),
        'Ernährungsziel erreicht', NULL, NULL
      );
    ELSE
      PERFORM public.reverse_org_points_by_source(_organization_id, _user_id, 'nutrition_day', NULL, 'nutrition_target_hit', 'target_no_longer_met');
    END IF;
  END IF;

  PERFORM public.recompute_org_streak(_user_id, _organization_id);
END; $$;

REVOKE ALL ON FUNCTION public.recompute_org_nutrition_day(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_org_nutrition_day(uuid, uuid, date) TO service_role;

-- ============================================================
-- Triggers (skip Bulls org — Bulls has its own ledger)
-- ============================================================

-- Daily check-in
CREATE OR REPLACE FUNCTION public.trg_org_checkin_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.organization_id IS NULL OR public.is_bulls_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  PERFORM public.award_org_points(
    NEW.user_id, NEW.organization_id, 'check_in'::public.org_point_category,
    'daily_checkin', 2, NEW.checkin_date,
    'athlete_checkin', NEW.id, NULL,
    jsonb_build_object('checkin_id', NEW.id), 'Daily Check-in', NULL, NULL
  );
  PERFORM public.recompute_org_streak(NEW.user_id, NEW.organization_id);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_checkin_award ON public.athlete_checkins;
CREATE TRIGGER trg_org_checkin_award
AFTER INSERT ON public.athlete_checkins
FOR EACH ROW EXECUTE FUNCTION public.trg_org_checkin_award();

-- Training session completed
CREATE OR REPLACE FUNCTION public.trg_org_training_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_cat public.org_point_category; v_kind text; v_pts int;
BEGIN
  IF NEW.organization_id IS NULL OR public.is_bulls_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NEW.is_rehab THEN v_cat := 'rehab'; v_kind := 'rehab_completed'; v_pts := 8;
    ELSIF NEW.focus = 'mobility' THEN v_cat := 'recovery'; v_kind := 'recovery_completed'; v_pts := 4;
    ELSIF NEW.source_week_session_id IS NOT NULL THEN v_cat := 'team_training'; v_kind := 'team_training_completed'; v_pts := 12;
    ELSIF NEW.focus IN ('strength','speed','agility','conditioning') THEN v_cat := 'training'; v_kind := 'training_completed'; v_pts := 10;
    ELSE
      -- default: individual training
      v_cat := 'training'; v_kind := 'training_completed'; v_pts := 10;
    END IF;
    PERFORM public.award_org_points(
      NEW.user_id, NEW.organization_id, v_cat, v_kind, v_pts, NEW.session_date,
      'athlete_training_session', NEW.id, NEW.team_id,
      jsonb_build_object('focus', NEW.focus, 'title', NEW.title, 'is_rehab', NEW.is_rehab),
      COALESCE(NEW.title, v_kind), NULL, NULL
    );
    PERFORM public.recompute_org_streak(NEW.user_id, NEW.organization_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.reverse_org_points_by_source(NEW.organization_id, NEW.user_id, 'athlete_training_session', NEW.id, NULL, 'training_uncompleted');
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_training_award ON public.athlete_training_session;
CREATE TRIGGER trg_org_training_award
AFTER UPDATE ON public.athlete_training_session
FOR EACH ROW EXECUTE FUNCTION public.trg_org_training_award();

-- Coach task completed
CREATE OR REPLACE FUNCTION public.trg_org_task_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_uid uuid;
BEGIN
  IF NEW.organization_id IS NULL OR public.is_bulls_org(NEW.organization_id) THEN
    RETURN NEW;
  END IF;
  v_uid := COALESCE(NEW.assignee_user_id, NEW.user_id);
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.task_type IN ('daily_checkin','challenge','team_training','athletic_training') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.award_org_points(
      v_uid, NEW.organization_id, 'tasks'::public.org_point_category,
      'task_completed', 2, COALESCE(NEW.scheduled_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
      'organization_task', NEW.id, NEW.team_id,
      jsonb_build_object('task_type', NEW.task_type, 'title', NEW.title),
      COALESCE(NEW.title, 'Coach-Aufgabe'), NULL, 6
    );
    PERFORM public.recompute_org_streak(v_uid, NEW.organization_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.reverse_org_points_by_source(NEW.organization_id, v_uid, 'organization_task', NEW.id, 'task_completed', 'task_reopened');
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_task_award ON public.organization_tasks;
CREATE TRIGGER trg_org_task_award
AFTER UPDATE ON public.organization_tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_org_task_award();

-- Performance test attempts
CREATE OR REPLACE FUNCTION public.trg_org_test_attempt_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_date date; v_team uuid;
BEGIN
  SELECT organization_id, test_date, team_id INTO v_org, v_date, v_team
  FROM public.performance_test_sessions WHERE id = NEW.session_id;
  IF v_org IS NULL OR public.is_bulls_org(v_org) THEN RETURN NEW; END IF;
  IF NEW.valid IS NOT TRUE OR NEW.raw_value IS NULL THEN RETURN NEW; END IF;

  PERFORM public.award_org_points(
    NEW.user_id, v_org, 'development'::public.org_point_category,
    'test_session_completed', 20, COALESCE(v_date, (now() AT TIME ZONE 'Europe/Berlin')::date),
    'performance_test_session', NEW.session_id, v_team,
    jsonb_build_object('session_id', NEW.session_id),
    'Performance-Test absolviert', NULL, NULL
  );
  PERFORM public.award_org_test_improvements(NEW.session_id, NEW.user_id, v_org);
  PERFORM public.recompute_org_streak(NEW.user_id, v_org);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_test_attempt_award ON public.performance_test_attempts;
CREATE TRIGGER trg_org_test_attempt_award
AFTER INSERT ON public.performance_test_attempts
FOR EACH ROW EXECUTE FUNCTION public.trg_org_test_attempt_award();

-- Challenge point events mirror
CREATE OR REPLACE FUNCTION public.trg_org_challenge_mirror()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.organization_id IS NULL OR public.is_bulls_org(NEW.organization_id) THEN RETURN NEW; END IF;
  IF NEW.points IS NULL OR NEW.points = 0 THEN RETURN NEW; END IF;
  PERFORM public.award_org_points(
    NEW.user_id, NEW.organization_id, 'challenge'::public.org_point_category,
    'challenge_event', NEW.points, NEW.event_date,
    'organization_challenge_point_event', NEW.id, NULL,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'rule_id', NEW.rule_id, 'source_type', NEW.source_type),
    'Challenge-Punkte gespiegelt', NEW.created_by, NULL
  );
  PERFORM public.recompute_org_streak(NEW.user_id, NEW.organization_id);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_challenge_mirror ON public.organization_challenge_point_events;
CREATE TRIGGER trg_org_challenge_mirror
AFTER INSERT ON public.organization_challenge_point_events
FOR EACH ROW EXECUTE FUNCTION public.trg_org_challenge_mirror();

-- Food entries → nutrition recompute for every active non-Bulls org membership
CREATE OR REPLACE FUNCTION public.trg_org_food_entry_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_uid uuid; v_day date; v_org record;
BEGIN
  IF TG_OP = 'DELETE' THEN v_uid := OLD.user_id; v_day := OLD.entry_date;
  ELSE v_uid := NEW.user_id; v_day := NEW.entry_date; END IF;
  FOR v_org IN
    SELECT DISTINCT om.organization_id
    FROM public.organization_memberships om
    WHERE om.user_id = v_uid
      AND (om.status IS NULL OR om.status = 'active')
      AND NOT public.is_bulls_org(om.organization_id)
  LOOP
    PERFORM public.recompute_org_nutrition_day(v_uid, v_org.organization_id, v_day);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $fn$;

DROP TRIGGER IF EXISTS trg_org_food_entry_recompute ON public.food_entries;
CREATE TRIGGER trg_org_food_entry_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.food_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_org_food_entry_recompute();

-- ============================================================
-- READ RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_org_ranking(
  _organization_id uuid,
  _since date DEFAULT NULL, _until date DEFAULT NULL,
  _team_id uuid DEFAULT NULL, _position text DEFAULT NULL
) RETURNS TABLE (
  user_id uuid, display_name text, nickname text,
  total_points integer, team_id uuid, sport_position text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.nickname END,
    SUM(e.points)::int,
    tm_agg.team_id,
    COALESCE(tm_agg.tm_position, p.sport_position)
  FROM public.org_ranking_events e
  JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN LATERAL (
    SELECT tm.team_id, tm.position AS tm_position
    FROM public.team_memberships tm
    JOIN public.organization_teams ot ON ot.id = tm.team_id
    WHERE tm.user_id = e.user_id AND ot.organization_id = e.organization_id
      AND (tm.status IS NULL OR tm.status = 'active')
    ORDER BY tm.created_at DESC NULLS LAST LIMIT 1
  ) tm_agg ON true
  WHERE e.organization_id = _organization_id AND e.status = 'active'
    AND (_since IS NULL OR e.event_date >= _since)
    AND (_until IS NULL OR e.event_date <= _until)
    AND (_team_id IS NULL OR tm_agg.team_id = _team_id)
    AND (_position IS NULL OR tm_agg.tm_position ILIKE '%'||_position||'%'
         OR p.sport_position ILIKE '%'||_position||'%')
  GROUP BY e.user_id, p.is_minor, p.display_name, p.nickname, tm_agg.team_id, tm_agg.tm_position, p.sport_position
  HAVING SUM(e.points) > 0
  ORDER BY SUM(e.points) DESC, display_name ASC
$$;
GRANT EXECUTE ON FUNCTION public.get_org_ranking(uuid, date, date, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_org_score_breakdown(
  _user_id uuid, _organization_id uuid,
  _since date DEFAULT NULL, _until date DEFAULT NULL
) RETURNS TABLE (category public.org_point_category, total_points integer, event_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.category, SUM(e.points)::int, COUNT(*)::int
  FROM public.org_ranking_events e
  WHERE e.user_id = _user_id AND e.organization_id = _organization_id
    AND e.status = 'active'
    AND (_since IS NULL OR e.event_date >= _since)
    AND (_until IS NULL OR e.event_date <= _until)
  GROUP BY e.category ORDER BY SUM(e.points) DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_org_score_breakdown(uuid, uuid, date, date) TO authenticated, service_role;

-- ============================================================
-- Monthly standings + finalization
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_monthly_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  year int NOT NULL, month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  rank int NOT NULL, user_id uuid NOT NULL,
  final_points int NOT NULL DEFAULT 0,
  completed_trainings int NOT NULL DEFAULT 0,
  planned_trainings int NOT NULL DEFAULT 0,
  plan_completion_rate numeric(5,4) NOT NULL DEFAULT 0,
  check_in_days int NOT NULL DEFAULT 0,
  check_in_completion_rate numeric(5,4) NOT NULL DEFAULT 0,
  active_days int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year, month, user_id),
  UNIQUE (organization_id, year, month, rank)
);
CREATE INDEX IF NOT EXISTS idx_oms_org_period ON public.org_monthly_standings (organization_id, year, month, rank);
CREATE INDEX IF NOT EXISTS idx_oms_user ON public.org_monthly_standings (user_id, year DESC, month DESC);
GRANT SELECT ON public.org_monthly_standings TO authenticated;
GRANT ALL ON public.org_monthly_standings TO service_role;
ALTER TABLE public.org_monthly_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oms_org_read" ON public.org_monthly_standings FOR SELECT TO authenticated
USING (user_id = auth.uid()
  OR public.is_org_staff(auth.uid(), organization_id, NULL)
  OR public.is_org_member(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.org_monthly_finalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  year int NOT NULL, month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'finalized',
  winner_user_id uuid, winner_points int,
  participant_count int NOT NULL DEFAULT 0,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year, month)
);
GRANT SELECT ON public.org_monthly_finalizations TO authenticated;
GRANT ALL ON public.org_monthly_finalizations TO service_role;
ALTER TABLE public.org_monthly_finalizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "omf_org_read" ON public.org_monthly_finalizations FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, NULL));

-- Live monthly ranking
CREATE OR REPLACE FUNCTION public.get_org_month_ranking(
  _organization_id uuid, _year int, _month int
) RETURNS TABLE (
  rank int, user_id uuid, display_name text, nickname text,
  total_points int, completed_trainings int, planned_trainings int,
  plan_completion_rate numeric, check_in_days int,
  check_in_completion_rate numeric, active_days int,
  team_id uuid, sport_position text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start date := make_date(_year, _month, 1);
  v_end date := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_days_elapsed int; v_finalized boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.org_monthly_finalizations
    WHERE organization_id=_organization_id AND year=_year AND month=_month) INTO v_finalized;
  IF v_finalized THEN
    RETURN QUERY
    SELECT s.rank, s.user_id,
      CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
      CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.nickname END,
      s.final_points, s.completed_trainings, s.planned_trainings,
      s.plan_completion_rate, s.check_in_days, s.check_in_completion_rate,
      s.active_days, NULL::uuid, NULL::text
    FROM public.org_monthly_standings s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.organization_id=_organization_id AND s.year=_year AND s.month=_month
    ORDER BY s.rank ASC;
    RETURN;
  END IF;

  IF v_end > v_today THEN v_days_elapsed := GREATEST(1, v_today - v_start + 1);
  ELSE v_days_elapsed := v_end - v_start + 1; END IF;

  RETURN QUERY
  WITH pts AS (
    SELECT e.user_id, SUM(e.points)::int AS pts,
      COUNT(DISTINCT e.event_date)::int AS active_days
    FROM public.org_ranking_events e
    WHERE e.organization_id=_organization_id AND e.status='active'
      AND e.event_date BETWEEN v_start AND v_end
    GROUP BY e.user_id
  ),
  trainings AS (
    SELECT ats.user_id,
      COUNT(*) FILTER (WHERE ats.status='completed')::int AS completed_ct,
      COUNT(*)::int AS planned_ct
    FROM public.athlete_training_session ats
    WHERE ats.organization_id=_organization_id
      AND ats.session_date BETWEEN v_start AND v_end
    GROUP BY ats.user_id
  ),
  checkins AS (
    SELECT ac.user_id, COUNT(DISTINCT ac.checkin_date)::int AS ci_days
    FROM public.athlete_checkins ac
    WHERE ac.organization_id=_organization_id
      AND ac.checkin_date BETWEEN v_start AND v_end
    GROUP BY ac.user_id
  ),
  base AS (
    SELECT pts.user_id, pts.pts AS total_points,
      COALESCE(t.completed_ct,0) AS completed_ct,
      COALESCE(t.planned_ct,0) AS planned_ct,
      CASE WHEN COALESCE(t.planned_ct,0)>0
        THEN (t.completed_ct::numeric/t.planned_ct::numeric) ELSE 0::numeric END AS plan_rate,
      COALESCE(c.ci_days,0) AS ci_days,
      (COALESCE(c.ci_days,0)::numeric/GREATEST(v_days_elapsed,1)::numeric) AS ci_rate,
      pts.active_days
    FROM pts LEFT JOIN trainings t ON t.user_id=pts.user_id
    LEFT JOIN checkins c ON c.user_id=pts.user_id
    WHERE pts.pts>0
  ),
  ranked AS (
    SELECT b.*, ROW_NUMBER() OVER (
      ORDER BY b.total_points DESC, b.plan_rate DESC, b.completed_ct DESC,
        b.ci_rate DESC, b.active_days DESC, b.user_id ASC
    )::int AS r FROM base b
  )
  SELECT ranked.r, ranked.user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.nickname END,
    ranked.total_points, ranked.completed_ct, ranked.planned_ct,
    ranked.plan_rate, ranked.ci_days, ranked.ci_rate, ranked.active_days,
    tm.team_id, COALESCE(tm.position, p.sport_position)
  FROM ranked
  JOIN public.profiles p ON p.id = ranked.user_id
  LEFT JOIN LATERAL (
    SELECT tm2.team_id, tm2.position FROM public.team_memberships tm2
    JOIN public.organization_teams ot ON ot.id=tm2.team_id
    WHERE tm2.user_id=ranked.user_id AND ot.organization_id=_organization_id
      AND (tm2.status IS NULL OR tm2.status='active')
    ORDER BY tm2.created_at DESC NULLS LAST LIMIT 1
  ) tm ON true
  ORDER BY ranked.r ASC;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_org_month_ranking(uuid, int, int) TO authenticated, service_role;

-- Finalize a specific month (idempotent)
CREATE OR REPLACE FUNCTION public.finalize_org_month(
  _organization_id uuid, _year int, _month int
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_start date := make_date(_year,_month,1);
  v_end date := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_rows int := 0; v_winner uuid; v_winner_pts int;
BEGIN
  SELECT id INTO v_id FROM public.org_monthly_finalizations
  WHERE organization_id=_organization_id AND year=_year AND month=_month;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF v_end >= v_today THEN
    RAISE EXCEPTION 'Month %/% not over yet', _year, _month;
  END IF;
  INSERT INTO public.org_monthly_standings (
    organization_id, year, month, rank, user_id, final_points,
    completed_trainings, planned_trainings, plan_completion_rate,
    check_in_days, check_in_completion_rate, active_days
  ) SELECT _organization_id, _year, _month, r.rank, r.user_id, r.total_points,
    r.completed_trainings, r.planned_trainings, r.plan_completion_rate,
    r.check_in_days, r.check_in_completion_rate, r.active_days
  FROM public.get_org_month_ranking(_organization_id, _year, _month) r;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  SELECT user_id, final_points INTO v_winner, v_winner_pts
  FROM public.org_monthly_standings
  WHERE organization_id=_organization_id AND year=_year AND month=_month AND rank=1;
  INSERT INTO public.org_monthly_finalizations (
    organization_id, year, month, status, winner_user_id, winner_points, participant_count
  ) VALUES (_organization_id, _year, _month, 'finalized', v_winner, v_winner_pts, v_rows)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.finalize_org_month(uuid, int, int) TO service_role;

-- Auto-finalize previous month for every non-Bulls org that has any activity
CREATE OR REPLACE FUNCTION public.finalize_all_orgs_previous_month()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_prev date := (v_today - INTERVAL '1 day')::date;
  v_y int := EXTRACT(YEAR FROM v_prev)::int;
  v_m int := EXTRACT(MONTH FROM v_prev)::int;
  v_start date := make_date(v_y, v_m, 1);
  v_end date := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_org uuid;
BEGIN
  FOR v_org IN
    SELECT DISTINCT organization_id FROM public.org_ranking_events
    WHERE event_date BETWEEN v_start AND v_end AND status = 'active'
  LOOP
    BEGIN
      PERFORM public.finalize_org_month(v_org, v_y, v_m);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'finalize_org_month failed for %: %', v_org, SQLERRM;
    END;
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.finalize_all_orgs_previous_month() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'org-finalize-monthly') THEN
      PERFORM cron.schedule(
        'org-finalize-monthly',
        '5 0 * * *',
        $cron$ SELECT public.finalize_all_orgs_previous_month(); $cron$
      );
    END IF;
  END IF;
END $$;

-- Hall of fame + user awards
CREATE OR REPLACE FUNCTION public.get_org_monthly_winners(
  _organization_id uuid, _limit int DEFAULT 24
) RETURNS TABLE (year int, month int, winner_user_id uuid,
  winner_display_name text, winner_points int, finalized_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.year, f.month, f.winner_user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
    f.winner_points, f.finalized_at
  FROM public.org_monthly_finalizations f
  LEFT JOIN public.profiles p ON p.id = f.winner_user_id
  WHERE f.organization_id = _organization_id AND f.status = 'finalized'
    AND f.winner_user_id IS NOT NULL
  ORDER BY f.year DESC, f.month DESC LIMIT _limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_org_monthly_winners(uuid, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_org_user_potm_awards(
  _user_id uuid, _organization_id uuid
) RETURNS TABLE (year int, month int, points int, finalized_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT year, month, winner_points, finalized_at
  FROM public.org_monthly_finalizations
  WHERE organization_id=_organization_id AND status='finalized' AND winner_user_id=_user_id
  ORDER BY year DESC, month DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_org_user_potm_awards(uuid, uuid) TO authenticated, service_role;

-- Manual adjustment (SECURITY DEFINER; caller must be org staff)
CREATE OR REPLACE FUNCTION public.adjust_org_points_manual(
  _organization_id uuid, _target_user_id uuid, _points int, _reason text,
  _category public.org_point_category DEFAULT 'tasks',
  _event_date date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_date date;
BEGIN
  IF NOT public.is_org_staff(auth.uid(), _organization_id, NULL) THEN
    RAISE EXCEPTION 'Only org staff may adjust points';
  END IF;
  IF public.is_bulls_org(_organization_id) THEN
    RAISE EXCEPTION 'Bulls has its own ranking ledger; use adjust_bulls_points_manual';
  END IF;
  IF _points = 0 THEN RAISE EXCEPTION 'Points may not be zero'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN RAISE EXCEPTION 'Reason required'; END IF;
  v_date := COALESCE(_event_date, (now() AT TIME ZONE 'Europe/Berlin')::date);
  INSERT INTO public.org_ranking_events (
    user_id, organization_id, category, event_kind, points, event_date,
    source_type, reason, awarded_by, metadata
  ) VALUES (
    _target_user_id, _organization_id, _category, 'manual_adjustment',
    _points, v_date, 'manual_adjustment', _reason, auth.uid(),
    jsonb_build_object('manual', true)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.adjust_org_points_manual(uuid, uuid, int, text, public.org_point_category, date) TO authenticated;
