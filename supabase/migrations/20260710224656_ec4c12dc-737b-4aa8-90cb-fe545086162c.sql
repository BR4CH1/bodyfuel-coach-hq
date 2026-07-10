
-- ============================================================
-- Bulls Monthly Ranking + Player of the Month
-- ============================================================

-- 1) Standings archive (one row per player per finalized month)
CREATE TABLE IF NOT EXISTS public.bulls_monthly_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  rank int NOT NULL,
  user_id uuid NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_bms_org_period ON public.bulls_monthly_standings (organization_id, year, month, rank);
CREATE INDEX IF NOT EXISTS idx_bms_user ON public.bulls_monthly_standings (user_id, year DESC, month DESC);

GRANT SELECT ON public.bulls_monthly_standings TO authenticated;
GRANT ALL ON public.bulls_monthly_standings TO service_role;
ALTER TABLE public.bulls_monthly_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bms_self_or_bulls_staff_read"
ON public.bulls_monthly_standings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_staff(auth.uid(), organization_id, NULL)
  OR public.is_org_member(auth.uid(), organization_id)
);

-- 2) Finalization ledger (one row per org / year / month)
CREATE TABLE IF NOT EXISTS public.bulls_monthly_finalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'finalized',
  winner_user_id uuid,
  winner_points int,
  participant_count int NOT NULL DEFAULT 0,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, year, month)
);

GRANT SELECT ON public.bulls_monthly_finalizations TO authenticated;
GRANT ALL ON public.bulls_monthly_finalizations TO service_role;
ALTER TABLE public.bulls_monthly_finalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bmf_org_read"
ON public.bulls_monthly_finalizations FOR SELECT
TO authenticated
USING (
  public.is_org_member(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, NULL)
);

-- ============================================================
-- 3) Live monthly ranking (for current/non-finalized months)
--    Returns full leaderboard with tie-breaker metrics.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_bulls_month_ranking(
  _organization_id uuid,
  _year int,
  _month int
)
RETURNS TABLE (
  rank int,
  user_id uuid,
  display_name text,
  nickname text,
  total_points int,
  completed_trainings int,
  planned_trainings int,
  plan_completion_rate numeric,
  check_in_days int,
  check_in_completion_rate numeric,
  active_days int,
  team_id uuid,
  sport_position text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := make_date(_year, _month, 1);
  v_end   date := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_days_elapsed int;
  v_finalized boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.bulls_monthly_finalizations
    WHERE organization_id = _organization_id AND year = _year AND month = _month
  ) INTO v_finalized;

  -- If finalized: read from archive (already ranked).
  IF v_finalized THEN
    RETURN QUERY
    SELECT
      s.rank,
      s.user_id,
      CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
      CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.nickname END,
      s.final_points,
      s.completed_trainings,
      s.planned_trainings,
      s.plan_completion_rate,
      s.check_in_days,
      s.check_in_completion_rate,
      s.active_days,
      NULL::uuid,
      NULL::text
    FROM public.bulls_monthly_standings s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.organization_id = _organization_id
      AND s.year = _year AND s.month = _month
    ORDER BY s.rank ASC;
    RETURN;
  END IF;

  IF v_end > v_today THEN
    v_days_elapsed := GREATEST(1, v_today - v_start + 1);
  ELSE
    v_days_elapsed := v_end - v_start + 1;
  END IF;

  RETURN QUERY
  WITH pts AS (
    SELECT e.user_id,
           SUM(e.points)::int AS pts,
           COUNT(DISTINCT e.event_date)::int AS active_days
    FROM public.bulls_ranking_events e
    WHERE e.organization_id = _organization_id
      AND e.status = 'active'
      AND e.event_date BETWEEN v_start AND v_end
    GROUP BY e.user_id
  ),
  trainings AS (
    SELECT ats.user_id,
           COUNT(*) FILTER (WHERE ats.status = 'completed')::int AS completed_ct,
           COUNT(*)::int AS planned_ct
    FROM public.athlete_training_session ats
    WHERE ats.organization_id = _organization_id
      AND ats.session_date BETWEEN v_start AND v_end
    GROUP BY ats.user_id
  ),
  checkins AS (
    SELECT ac.user_id,
           COUNT(DISTINCT ac.checkin_date)::int AS ci_days
    FROM public.athlete_checkins ac
    WHERE ac.checkin_date BETWEEN v_start AND v_end
    GROUP BY ac.user_id
  ),
  base AS (
    SELECT
      pts.user_id,
      pts.pts AS total_points,
      COALESCE(t.completed_ct, 0) AS completed_ct,
      COALESCE(t.planned_ct, 0) AS planned_ct,
      CASE WHEN COALESCE(t.planned_ct,0) > 0
           THEN (t.completed_ct::numeric / t.planned_ct::numeric)
           ELSE 0::numeric END AS plan_rate,
      COALESCE(c.ci_days, 0) AS ci_days,
      (COALESCE(c.ci_days, 0)::numeric / GREATEST(v_days_elapsed,1)::numeric) AS ci_rate,
      pts.active_days
    FROM pts
    LEFT JOIN trainings t ON t.user_id = pts.user_id
    LEFT JOIN checkins c ON c.user_id = pts.user_id
    WHERE pts.pts > 0
  ),
  ranked AS (
    SELECT b.*,
           ROW_NUMBER() OVER (
             ORDER BY b.total_points DESC,
                      b.plan_rate DESC,
                      b.completed_ct DESC,
                      b.ci_rate DESC,
                      b.active_days DESC,
                      b.user_id ASC
           )::int AS r
    FROM base b
  )
  SELECT
    ranked.r AS rank,
    ranked.user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END AS display_name,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.nickname END AS nickname,
    ranked.total_points,
    ranked.completed_ct,
    ranked.planned_ct,
    ranked.plan_rate,
    ranked.ci_days,
    ranked.ci_rate,
    ranked.active_days,
    tm.team_id,
    COALESCE(tm.position, p.sport_position) AS sport_position
  FROM ranked
  JOIN public.profiles p ON p.id = ranked.user_id
  LEFT JOIN LATERAL (
    SELECT tm2.team_id, tm2.position
    FROM public.team_memberships tm2
    JOIN public.organization_teams ot ON ot.id = tm2.team_id
    WHERE tm2.user_id = ranked.user_id
      AND ot.organization_id = _organization_id
      AND (tm2.status IS NULL OR tm2.status = 'active')
    ORDER BY tm2.created_at DESC NULLS LAST LIMIT 1
  ) tm ON true
  ORDER BY ranked.r ASC;
END;
$$;

-- ============================================================
-- 4) Finalize month (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_bulls_month(
  _organization_id uuid,
  _year int,
  _month int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_id uuid;
  v_start date := make_date(_year, _month, 1);
  v_end   date := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_rows int := 0;
  v_winner uuid;
  v_winner_pts int;
BEGIN
  -- Idempotency
  SELECT id INTO v_final_id
  FROM public.bulls_monthly_finalizations
  WHERE organization_id = _organization_id AND year = _year AND month = _month;
  IF v_final_id IS NOT NULL THEN
    RETURN v_final_id;
  END IF;

  -- Only finalize past months
  IF v_end >= v_today THEN
    RAISE EXCEPTION 'Month % / % is not over yet (today: %)', _year, _month, v_today;
  END IF;

  -- Snapshot standings
  INSERT INTO public.bulls_monthly_standings (
    organization_id, year, month, rank, user_id, final_points,
    completed_trainings, planned_trainings, plan_completion_rate,
    check_in_days, check_in_completion_rate, active_days
  )
  SELECT
    _organization_id, _year, _month,
    r.rank, r.user_id, r.total_points,
    r.completed_trainings, r.planned_trainings, r.plan_completion_rate,
    r.check_in_days, r.check_in_completion_rate, r.active_days
  FROM public.get_bulls_month_ranking(_organization_id, _year, _month) r;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  SELECT user_id, final_points INTO v_winner, v_winner_pts
  FROM public.bulls_monthly_standings
  WHERE organization_id = _organization_id AND year = _year AND month = _month AND rank = 1;

  INSERT INTO public.bulls_monthly_finalizations (
    organization_id, year, month, status,
    winner_user_id, winner_points, participant_count
  ) VALUES (
    _organization_id, _year, _month, 'finalized',
    v_winner, v_winner_pts, v_rows
  )
  RETURNING id INTO v_final_id;

  RETURN v_final_id;
END;
$$;

-- ============================================================
-- 5) Auto-finalize prior month (called by cron on the 1st ≥ 00:05)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_bulls_previous_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bulls uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_prev date := (v_today - INTERVAL '1 day')::date;
  v_y int := EXTRACT(YEAR FROM v_prev)::int;
  v_m int := EXTRACT(MONTH FROM v_prev)::int;
BEGIN
  PERFORM public.finalize_bulls_month(v_bulls, v_y, v_m);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'finalize_bulls_previous_month failed: %', SQLERRM;
END;
$$;

-- Cron: daily 00:05 Europe/Berlin (pg_cron uses UTC → 23:05 UTC works for standard time; use both safe slots)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bulls-finalize-monthly') THEN
      PERFORM cron.schedule(
        'bulls-finalize-monthly',
        '5 0 * * *',  -- every day 00:05 UTC (≈01:05/02:05 Berlin — safely after month end)
        $cron$ SELECT public.finalize_bulls_previous_month(); $cron$
      );
    END IF;
  END IF;
END $$;

-- ============================================================
-- 6) Hall of fame + user awards
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_bulls_monthly_winners(
  _organization_id uuid,
  _limit int DEFAULT 24
)
RETURNS TABLE (
  year int,
  month int,
  winner_user_id uuid,
  winner_display_name text,
  winner_points int,
  finalized_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.year, f.month, f.winner_user_id,
    CASE WHEN p.is_minor THEN COALESCE(p.nickname,'Athlet*in') ELSE p.display_name END,
    f.winner_points, f.finalized_at
  FROM public.bulls_monthly_finalizations f
  LEFT JOIN public.profiles p ON p.id = f.winner_user_id
  WHERE f.organization_id = _organization_id
    AND f.status = 'finalized'
    AND f.winner_user_id IS NOT NULL
  ORDER BY f.year DESC, f.month DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.get_bulls_user_player_of_month_awards(
  _user_id uuid,
  _organization_id uuid
)
RETURNS TABLE (year int, month int, points int, finalized_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT year, month, winner_points, finalized_at
  FROM public.bulls_monthly_finalizations
  WHERE organization_id = _organization_id
    AND status = 'finalized'
    AND winner_user_id = _user_id
  ORDER BY year DESC, month DESC;
$$;
