
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bulls_point_category') THEN
    CREATE TYPE public.bulls_point_category AS ENUM (
      'training', 'team_training', 'nutrition', 'check_in', 'tasks',
      'recovery', 'rehab', 'development', 'challenge', 'streak'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.bulls_ranking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  team_id uuid,
  category public.bulls_point_category NOT NULL,
  event_kind text NOT NULL,
  points integer NOT NULL,
  event_date date NOT NULL,
  source_type text,
  source_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reversed')),
  reversed_by_event_id uuid REFERENCES public.bulls_ranking_events(id) ON DELETE SET NULL,
  reason text,
  awarded_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bulls_events_source_uidx
  ON public.bulls_ranking_events (user_id, event_kind, source_type, source_id)
  WHERE source_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS bulls_events_daily_uidx
  ON public.bulls_ranking_events (user_id, event_kind, event_date)
  WHERE source_id IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS bulls_events_org_date_idx
  ON public.bulls_ranking_events (organization_id, event_date DESC);
CREATE INDEX IF NOT EXISTS bulls_events_user_date_idx
  ON public.bulls_ranking_events (user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS bulls_events_category_idx
  ON public.bulls_ranking_events (organization_id, category, event_date DESC);

GRANT SELECT ON public.bulls_ranking_events TO authenticated;
GRANT ALL ON public.bulls_ranking_events TO service_role;

ALTER TABLE public.bulls_ranking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY bulls_events_own_select ON public.bulls_ranking_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY bulls_events_staff_select ON public.bulls_ranking_events
  FOR SELECT TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id));

DROP TRIGGER IF EXISTS bulls_events_touch ON public.bulls_ranking_events;
CREATE TRIGGER bulls_events_touch
  BEFORE UPDATE ON public.bulls_ranking_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
CREATE OR REPLACE FUNCTION public.award_bulls_points(
  _user_id uuid,
  _organization_id uuid,
  _category public.bulls_point_category,
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
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
  v_day_sum integer;
  v_effective_points integer := _points;
BEGIN
  IF _user_id IS NULL OR _organization_id IS NULL OR _event_kind IS NULL THEN
    RAISE EXCEPTION 'award_bulls_points: user_id, organization_id and event_kind are required';
  END IF;

  IF _source_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.bulls_ranking_events
    WHERE user_id = _user_id
      AND event_kind = _event_kind
      AND source_type IS NOT DISTINCT FROM _source_type
      AND source_id = _source_id
      AND status = 'active'
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing
    FROM public.bulls_ranking_events
    WHERE user_id = _user_id
      AND event_kind = _event_kind
      AND event_date = _event_date
      AND source_id IS NULL
      AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF _daily_cap IS NOT NULL THEN
    SELECT COALESCE(SUM(points), 0) INTO v_day_sum
    FROM public.bulls_ranking_events
    WHERE user_id = _user_id
      AND event_kind = _event_kind
      AND event_date = _event_date
      AND status = 'active';
    IF v_day_sum >= _daily_cap THEN
      RETURN NULL;
    END IF;
    IF v_day_sum + _points > _daily_cap THEN
      v_effective_points := _daily_cap - v_day_sum;
      IF v_effective_points <= 0 THEN
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.bulls_ranking_events (
    user_id, organization_id, team_id, category, event_kind, points,
    event_date, source_type, source_id, reason, awarded_by, metadata
  ) VALUES (
    _user_id, _organization_id, _team_id, _category, _event_kind, v_effective_points,
    _event_date, _source_type, _source_id, _reason, _awarded_by,
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.award_bulls_points(uuid, uuid, public.bulls_point_category, text, integer, date, text, uuid, uuid, jsonb, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_bulls_points(uuid, uuid, public.bulls_point_category, text, integer, date, text, uuid, uuid, jsonb, text, uuid, integer) TO service_role;

-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_bulls_points_by_source(
  _user_id uuid,
  _source_type text,
  _source_id uuid,
  _event_kind text DEFAULT NULL,
  _reason text DEFAULT 'activity_reverted'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count integer := 0;
  v_reversal_id uuid;
BEGIN
  FOR v_row IN
    SELECT * FROM public.bulls_ranking_events
    WHERE user_id = _user_id
      AND source_type = _source_type
      AND source_id = _source_id
      AND status = 'active'
      AND (_event_kind IS NULL OR event_kind = _event_kind)
  LOOP
    INSERT INTO public.bulls_ranking_events (
      user_id, organization_id, team_id, category, event_kind, points,
      event_date, source_type, source_id, status, reversed_by_event_id,
      reason, metadata
    ) VALUES (
      v_row.user_id, v_row.organization_id, v_row.team_id, v_row.category,
      v_row.event_kind || '_reversal', -v_row.points,
      v_row.event_date, v_row.source_type, v_row.source_id, 'reversed', v_row.id,
      _reason,
      jsonb_build_object('original_event_id', v_row.id)
    )
    RETURNING id INTO v_reversal_id;

    UPDATE public.bulls_ranking_events
      SET status = 'reversed', reversed_by_event_id = v_reversal_id, updated_at = now()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_bulls_points_by_source(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_bulls_points_by_source(uuid, text, uuid, text, text) TO service_role;

-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_bulls_streak(
  _user_id uuid,
  _organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak integer := 0;
  v_streak_start date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_check date;
  v_has_activity boolean;
  v_milestones int[] := ARRAY[3, 7, 14, 30];
  v_reward int[]    := ARRAY[5, 15, 30, 75];
  v_i int;
  v_milestone int;
  v_pts int;
  v_already boolean;
BEGIN
  v_check := v_today;
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.bulls_ranking_events
      WHERE user_id = _user_id
        AND event_date = v_check
        AND category <> 'streak'
        AND status = 'active'
    ) INTO v_has_activity;
    IF NOT v_has_activity THEN
      EXIT;
    END IF;
    v_streak := v_streak + 1;
    v_streak_start := v_check;
    v_check := v_check - 1;
  END LOOP;

  IF v_streak = 0 THEN
    RETURN;
  END IF;

  FOR v_i IN 1..array_length(v_milestones, 1) LOOP
    v_milestone := v_milestones[v_i];
    v_pts       := v_reward[v_i];
    IF v_streak >= v_milestone THEN
      SELECT EXISTS (
        SELECT 1 FROM public.bulls_ranking_events
        WHERE user_id = _user_id
          AND event_kind = 'streak_' || v_milestone
          AND source_type = 'streak_run'
          AND metadata->>'streak_start' = v_streak_start::text
          AND status = 'active'
      ) INTO v_already;

      IF NOT v_already THEN
        INSERT INTO public.bulls_ranking_events (
          user_id, organization_id, category, event_kind, points, event_date,
          source_type, metadata, reason
        ) VALUES (
          _user_id, _organization_id, 'streak', 'streak_' || v_milestone, v_pts, v_today,
          'streak_run',
          jsonb_build_object('streak_start', v_streak_start, 'days', v_streak),
          v_milestone || ' aktive Tage in Folge'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_bulls_streak(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_bulls_streak(uuid, uuid) TO service_role;

-- ============================================================
CREATE OR REPLACE FUNCTION public.award_bulls_test_improvements(
  _session_id uuid,
  _user_id uuid,
  _organization_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT session_date INTO v_event_date FROM public.performance_test_sessions WHERE id = _session_id;
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
        AND a2.valid = true
        AND a2.raw_value IS NOT NULL
        AND s2.id <> _session_id
        AND s2.session_date <= v_event_date;
      v_improved := v_prev_val IS NOT NULL AND v_row.raw_value < v_prev_val;
    ELSE
      SELECT MAX(a2.raw_value) INTO v_prev_val
      FROM public.performance_test_attempts a2
      JOIN public.performance_test_sessions s2 ON s2.id = a2.session_id
      WHERE a2.user_id = _user_id
        AND a2.test_definition_id = v_row.test_definition_id
        AND a2.valid = true
        AND a2.raw_value IS NOT NULL
        AND s2.id <> _session_id
        AND s2.session_date <= v_event_date;
      v_improved := v_prev_val IS NOT NULL AND v_row.raw_value > v_prev_val;
    END IF;

    IF v_improved THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.bulls_ranking_events
        WHERE user_id = _user_id
          AND event_kind = 'test_pb_improvement'
          AND source_type = 'performance_test_attempt'
          AND source_id = v_row.id
          AND status = 'active'
      ) THEN
        INSERT INTO public.bulls_ranking_events (
          user_id, organization_id, category, event_kind, points, event_date,
          source_type, source_id, reason, metadata
        ) VALUES (
          _user_id, _organization_id, 'development', 'test_pb_improvement', 10, v_event_date,
          'performance_test_attempt', v_row.id,
          'PB verbessert: ' || v_row.name,
          jsonb_build_object(
            'test_definition_id', v_row.test_definition_id,
            'new_value', v_row.raw_value,
            'prev_value', v_prev_val,
            'direction', v_dir,
            'session_id', _session_id
          )
        );
        v_cap_pts := v_cap_pts + 10;
        v_awarded := v_awarded + 10;
      END IF;
    END IF;
  END LOOP;

  RETURN v_awarded;
END;
$$;

REVOKE ALL ON FUNCTION public.award_bulls_test_improvements(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_bulls_test_improvements(uuid, uuid, uuid) TO service_role;

-- ============================================================
-- READ RPC: Ranking-Liste
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_bulls_ranking(
  _organization_id uuid,
  _since date DEFAULT NULL,
  _until date DEFAULT NULL,
  _team_id uuid DEFAULT NULL,
  _position text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  nickname text,
  total_points integer,
  team_id uuid,
  sport_position text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.display_name END AS display_name,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname, 'Athlet*in') ELSE p.nickname END AS nickname,
    SUM(e.points)::int AS total_points,
    tm_agg.team_id,
    COALESCE(tm_agg.tm_position, p.sport_position) AS sport_position
  FROM public.bulls_ranking_events e
  JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN LATERAL (
    SELECT tm.team_id, tm.position AS tm_position
    FROM public.team_memberships tm
    JOIN public.organization_teams ot ON ot.id = tm.team_id
    WHERE tm.user_id = e.user_id
      AND ot.organization_id = e.organization_id
      AND (tm.status IS NULL OR tm.status = 'active')
    ORDER BY tm.created_at DESC NULLS LAST LIMIT 1
  ) tm_agg ON true
  WHERE e.organization_id = _organization_id
    AND e.status = 'active'
    AND (_since IS NULL OR e.event_date >= _since)
    AND (_until IS NULL OR e.event_date <= _until)
    AND (_team_id IS NULL OR tm_agg.team_id = _team_id)
    AND (
      _position IS NULL
      OR tm_agg.tm_position ILIKE '%' || _position || '%'
      OR p.sport_position ILIKE '%' || _position || '%'
    )
  GROUP BY e.user_id, p.is_minor, p.display_name, p.nickname, tm_agg.team_id, tm_agg.tm_position, p.sport_position
  HAVING SUM(e.points) > 0
  ORDER BY total_points DESC, display_name ASC
$$;

REVOKE ALL ON FUNCTION public.get_bulls_ranking(uuid, date, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bulls_ranking(uuid, date, date, uuid, text) TO authenticated, service_role;

-- ============================================================
-- READ RPC: Score-Aufschlüsselung
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_bulls_score_breakdown(
  _user_id uuid,
  _organization_id uuid,
  _since date DEFAULT NULL,
  _until date DEFAULT NULL
)
RETURNS TABLE (
  category public.bulls_point_category,
  total_points integer,
  event_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.category,
    SUM(e.points)::int AS total_points,
    COUNT(*)::int AS event_count
  FROM public.bulls_ranking_events e
  WHERE e.user_id = _user_id
    AND e.organization_id = _organization_id
    AND e.status = 'active'
    AND (_since IS NULL OR e.event_date >= _since)
    AND (_until IS NULL OR e.event_date <= _until)
  GROUP BY e.category
  ORDER BY total_points DESC
$$;

REVOKE ALL ON FUNCTION public.get_bulls_score_breakdown(uuid, uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bulls_score_breakdown(uuid, uuid, date, date) TO authenticated, service_role;
