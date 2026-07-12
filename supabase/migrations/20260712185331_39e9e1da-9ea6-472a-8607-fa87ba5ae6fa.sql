CREATE OR REPLACE FUNCTION public.get_team_of_the_month_candidates(
  _organization_id UUID,
  _month_start DATE
)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  athlete_count INTEGER,
  avg_bfr_start NUMERIC,
  avg_bfr_end NUMERIC,
  avg_delta NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_range AS (
    SELECT _month_start::timestamptz AS start_ts,
           (_month_start + INTERVAL '1 month')::timestamptz AS end_ts
  ),
  team_athletes AS (
    SELECT tm.team_id, ot.name AS team_name, tm.user_id
    FROM public.team_memberships tm
    JOIN public.organization_teams ot ON ot.id = tm.team_id
    WHERE ot.organization_id = _organization_id
      AND tm.status = 'active'
  ),
  start_snap AS (
    SELECT DISTINCT ON (h.user_id) h.user_id, h.bfr
    FROM public.player_card_history h, month_range mr
    WHERE h.snapshot_at < mr.start_ts
    ORDER BY h.user_id, h.snapshot_at DESC
  ),
  end_snap AS (
    SELECT DISTINCT ON (h.user_id) h.user_id, h.bfr
    FROM public.player_card_history h, month_range mr
    WHERE h.snapshot_at < mr.end_ts
    ORDER BY h.user_id, h.snapshot_at DESC
  )
  SELECT
    ta.team_id,
    ta.team_name,
    COUNT(*)::int AS athlete_count,
    ROUND(AVG(COALESCE(s.bfr, e.bfr, 0))::numeric, 1) AS avg_bfr_start,
    ROUND(AVG(COALESCE(e.bfr, 0))::numeric, 1) AS avg_bfr_end,
    ROUND(AVG(COALESCE(e.bfr, 0) - COALESCE(s.bfr, e.bfr, 0))::numeric, 1) AS avg_delta
  FROM team_athletes ta
  LEFT JOIN start_snap s ON s.user_id = ta.user_id
  LEFT JOIN end_snap e   ON e.user_id = ta.user_id
  WHERE e.bfr IS NOT NULL
  GROUP BY ta.team_id, ta.team_name
  HAVING COUNT(*) > 0
  ORDER BY avg_delta DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_of_the_month_candidates(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_of_the_month_candidates(UUID, DATE) TO authenticated;