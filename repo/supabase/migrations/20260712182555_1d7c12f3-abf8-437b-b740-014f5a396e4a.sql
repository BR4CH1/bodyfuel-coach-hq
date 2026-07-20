
CREATE TABLE public.player_card_monthly_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bfr_at_award INT NOT NULL,
  bfr_delta INT NOT NULL DEFAULT 0,
  award_kind TEXT NOT NULL DEFAULT 'top_bfr',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  finalized_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, team_id, year, month, award_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_card_monthly_awards TO authenticated;
GRANT ALL ON public.player_card_monthly_awards TO service_role;

ALTER TABLE public.player_card_monthly_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read awards"
  ON public.player_card_monthly_awards FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.organization_memberships m
            WHERE m.user_id = auth.uid() AND m.organization_id = player_card_monthly_awards.organization_id AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM public.staff_assignments s
               WHERE s.user_id = auth.uid() AND s.organization_id = player_card_monthly_awards.organization_id)
    OR public.has_role(auth.uid(), 'platform_owner')
  );

CREATE POLICY "staff can write awards"
  ON public.player_card_monthly_awards FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff_assignments s
            WHERE s.user_id = auth.uid() AND s.organization_id = player_card_monthly_awards.organization_id)
    OR public.has_role(auth.uid(), 'platform_owner')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff_assignments s
            WHERE s.user_id = auth.uid() AND s.organization_id = player_card_monthly_awards.organization_id)
    OR public.has_role(auth.uid(), 'platform_owner')
  );

CREATE TRIGGER trg_player_card_monthly_awards_updated
  BEFORE UPDATE ON public.player_card_monthly_awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pcma_org_ym ON public.player_card_monthly_awards (organization_id, year DESC, month DESC);


CREATE OR REPLACE FUNCTION public.get_player_card_ranking(
  _organization_id UUID,
  _team_id UUID DEFAULT NULL,
  _limit INT DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  position_key TEXT,
  team_id UUID,
  team_name TEXT,
  bfr INT,
  tier TEXT,
  spd INT, acc INT, agi INT, pow INT, str INT, end_score INT,
  is_provisional BOOLEAN,
  computed_at TIMESTAMPTZ,
  rank_num INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH scoped AS (
    SELECT
      pc.user_id,
      COALESCE(p.display_name, p.nickname) AS display_name,
      p.avatar_url AS avatar_url,
      pc.position_key,
      tm.team_id,
      ot.name AS team_name,
      pc.bfr, pc.tier,
      pc.spd, pc.acc, pc.agi, pc.pow, pc.str, pc.end_score,
      pc.is_provisional,
      pc.computed_at
    FROM public.player_cards pc
    JOIN public.profiles p ON p.id = pc.user_id
    LEFT JOIN public.team_memberships tm ON tm.user_id = pc.user_id AND tm.status = 'active'
    LEFT JOIN public.organization_teams ot ON ot.id = tm.team_id AND ot.organization_id = pc.organization_id
    WHERE pc.organization_id = _organization_id
      AND (_team_id IS NULL OR tm.team_id = _team_id)
      AND pc.bfr IS NOT NULL
  )
  SELECT
    user_id, display_name, avatar_url, position_key, team_id, team_name,
    bfr, tier, spd, acc, agi, pow, str, end_score,
    is_provisional, computed_at,
    (ROW_NUMBER() OVER (ORDER BY bfr DESC, computed_at ASC))::INT AS rank_num
  FROM scoped
  ORDER BY bfr DESC, computed_at ASC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_card_ranking(UUID, UUID, INT) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_player_card_month_candidates(
  _organization_id UUID,
  _year INT,
  _month INT
)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  position_key TEXT,
  bfr_start INT,
  bfr_end INT,
  bfr_delta INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      make_timestamptz(_year, _month, 1, 0, 0, 0, 'UTC') AS month_start,
      (make_timestamptz(_year, _month, 1, 0, 0, 0, 'UTC') + INTERVAL '1 month') AS month_end
  ),
  end_bfr AS (
    SELECT DISTINCT ON (h.user_id)
      h.user_id, h.bfr
    FROM public.player_card_history h, bounds b
    WHERE h.organization_id = _organization_id AND h.snapshot_at < b.month_end
    ORDER BY h.user_id, h.snapshot_at DESC
  ),
  start_bfr AS (
    SELECT DISTINCT ON (h.user_id)
      h.user_id, h.bfr
    FROM public.player_card_history h, bounds b
    WHERE h.organization_id = _organization_id AND h.snapshot_at < b.month_start
    ORDER BY h.user_id, h.snapshot_at DESC
  )
  SELECT
    eb.user_id,
    COALESCE(p.display_name, p.nickname) AS display_name,
    p.avatar_url AS avatar_url,
    pc.position_key,
    COALESCE(sb.bfr, eb.bfr)::INT AS bfr_start,
    eb.bfr::INT AS bfr_end,
    (eb.bfr - COALESCE(sb.bfr, eb.bfr))::INT AS bfr_delta
  FROM end_bfr eb
  JOIN public.profiles p ON p.id = eb.user_id
  LEFT JOIN public.player_cards pc ON pc.user_id = eb.user_id AND pc.organization_id = _organization_id
  LEFT JOIN start_bfr sb ON sb.user_id = eb.user_id
  WHERE eb.bfr IS NOT NULL
  ORDER BY bfr_delta DESC NULLS LAST, eb.bfr DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_card_month_candidates(UUID, INT, INT) TO authenticated;
