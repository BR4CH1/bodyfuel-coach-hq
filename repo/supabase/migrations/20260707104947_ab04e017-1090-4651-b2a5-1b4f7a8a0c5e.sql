
-- 1) organization_tasks: individuelle Zuweisung (Gruppe / Spieler)
ALTER TABLE public.organization_tasks
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS position_group text,
  ADD COLUMN IF NOT EXISTS assign_scope text NOT NULL DEFAULT 'team'
    CHECK (assign_scope IN ('team','group','athlete'));

CREATE INDEX IF NOT EXISTS idx_org_tasks_assignee ON public.organization_tasks(assignee_user_id) WHERE assignee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_tasks_group ON public.organization_tasks(team_id, position_group) WHERE position_group IS NOT NULL;

-- Sichtbarkeits-Helfer: Position eines Users in einem Team
CREATE OR REPLACE FUNCTION public.get_user_team_position(_user_id uuid, _team_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT position FROM public.team_memberships
  WHERE user_id = _user_id AND team_id = _team_id AND status = 'active'
  LIMIT 1;
$$;

-- Alte SELECT-Policy neu fassen: athlete/gruppe/team
DROP POLICY IF EXISTS "org tasks read own or staff" ON public.organization_tasks;
CREATE POLICY "org tasks read own or staff" ON public.organization_tasks
FOR SELECT TO authenticated USING (
  -- Staff / Coach / Org-Admin sehen alles der Org
  public.is_org_admin(auth.uid(), organization_id)
  OR public.is_org_staff(auth.uid(), organization_id, 'manage_training')
  OR public.has_role(auth.uid(), 'coach')
  -- Athlet: direkt zugewiesen
  OR assignee_user_id = auth.uid()
  -- Athlet: Team-Task ohne Gruppe/Spieler-Einschränkung
  OR (
    assign_scope = 'team'
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id = organization_tasks.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  )
  -- Athlet: Gruppen-Task, User hat die Position im Team
  OR (
    assign_scope = 'group'
    AND team_id IS NOT NULL
    AND position_group IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id = organization_tasks.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
        AND lower(tm.position) = lower(organization_tasks.position_group)
    )
  )
  -- Legacy: user_id direkt (bestehendes Verhalten)
  OR user_id = auth.uid()
);

-- 2) Gruppen-Wochenplan Training
CREATE TABLE IF NOT EXISTS public.org_group_training_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  position_group text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  title text NOT NULL DEFAULT 'Positions-Training',
  description text,
  start_time time,
  end_time time,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, position_group, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_group_training_schedule TO authenticated;
GRANT ALL ON public.org_group_training_schedule TO service_role;
ALTER TABLE public.org_group_training_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_training_manage_by_staff" ON public.org_group_training_schedule
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_training')
           OR public.has_role(auth.uid(), 'coach'))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_training')
           OR public.has_role(auth.uid(), 'coach'))
  )
);
CREATE POLICY "group_training_read_group_members" ON public.org_group_training_schedule
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = org_group_training_schedule.team_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND lower(tm.position) = lower(org_group_training_schedule.position_group)
  )
);
CREATE TRIGGER trg_group_training_updated_at BEFORE UPDATE ON public.org_group_training_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Individueller Wochenplan Training pro Athlet
CREATE TABLE IF NOT EXISTS public.athlete_training_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  title text NOT NULL DEFAULT 'Individuelles Training',
  description text,
  start_time time,
  end_time time,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_training_schedule TO authenticated;
GRANT ALL ON public.athlete_training_schedule TO service_role;
ALTER TABLE public.athlete_training_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_training_manage_by_staff" ON public.athlete_training_schedule
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  OR EXISTS (
    SELECT 1 FROM public.team_memberships tm
    JOIN public.organization_teams t ON t.id = tm.team_id
    WHERE tm.user_id = athlete_training_schedule.user_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_training'))
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  OR EXISTS (
    SELECT 1 FROM public.team_memberships tm
    JOIN public.organization_teams t ON t.id = tm.team_id
    WHERE tm.user_id = athlete_training_schedule.user_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_training'))
  )
);
CREATE POLICY "athlete_training_read_self" ON public.athlete_training_schedule
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_athlete_training_updated_at BEFORE UPDATE ON public.athlete_training_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Ernährungs-Wochenplan: Team / Gruppe / Athlet
CREATE TABLE IF NOT EXISTS public.org_team_nutrition_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  title text NOT NULL DEFAULT 'Ernährungsplan',
  description text,
  nutrition_plan_id uuid REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_team_nutrition_schedule TO authenticated;
GRANT ALL ON public.org_team_nutrition_schedule TO service_role;
ALTER TABLE public.org_team_nutrition_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_nutrition_manage_by_staff" ON public.org_team_nutrition_schedule
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition')
           OR public.has_role(auth.uid(), 'coach'))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition')
           OR public.has_role(auth.uid(), 'coach'))
  )
);
CREATE POLICY "team_nutrition_read_members" ON public.org_team_nutrition_schedule
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = org_team_nutrition_schedule.team_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  )
);
CREATE TRIGGER trg_team_nutrition_updated_at BEFORE UPDATE ON public.org_team_nutrition_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.org_group_nutrition_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  position_group text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  title text NOT NULL DEFAULT 'Positions-Ernährung',
  description text,
  nutrition_plan_id uuid REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, position_group, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_group_nutrition_schedule TO authenticated;
GRANT ALL ON public.org_group_nutrition_schedule TO service_role;
ALTER TABLE public.org_group_nutrition_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_nutrition_manage_by_staff" ON public.org_group_nutrition_schedule
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition')
           OR public.has_role(auth.uid(), 'coach'))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    WHERE t.id = team_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition')
           OR public.has_role(auth.uid(), 'coach'))
  )
);
CREATE POLICY "group_nutrition_read_group_members" ON public.org_group_nutrition_schedule
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = org_group_nutrition_schedule.team_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND lower(tm.position) = lower(org_group_nutrition_schedule.position_group)
  )
);
CREATE TRIGGER trg_group_nutrition_updated_at BEFORE UPDATE ON public.org_group_nutrition_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.athlete_nutrition_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  weekday smallint NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  title text NOT NULL DEFAULT 'Individueller Ernährungsplan',
  description text,
  nutrition_plan_id uuid REFERENCES public.nutrition_plans(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_nutrition_schedule TO authenticated;
GRANT ALL ON public.athlete_nutrition_schedule TO service_role;
ALTER TABLE public.athlete_nutrition_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "athlete_nutrition_manage_by_staff" ON public.athlete_nutrition_schedule
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  OR EXISTS (
    SELECT 1 FROM public.team_memberships tm
    JOIN public.organization_teams t ON t.id = tm.team_id
    WHERE tm.user_id = athlete_nutrition_schedule.user_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition'))
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'coach')
  OR EXISTS (
    SELECT 1 FROM public.team_memberships tm
    JOIN public.organization_teams t ON t.id = tm.team_id
    WHERE tm.user_id = athlete_nutrition_schedule.user_id
      AND (public.is_org_admin(auth.uid(), t.organization_id)
           OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_nutrition'))
  )
);
CREATE POLICY "athlete_nutrition_read_self" ON public.athlete_nutrition_schedule
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_athlete_nutrition_updated_at BEFORE UPDATE ON public.athlete_nutrition_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Helfer: Positionen eines Teams (für Gruppen-Dropdown)
CREATE OR REPLACE FUNCTION public.get_team_position_groups(_team_id uuid)
RETURNS TABLE(position_group text, athlete_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT position AS position_group, COUNT(*)::bigint AS athlete_count
  FROM public.team_memberships
  WHERE team_id = _team_id
    AND status = 'active'
    AND position IS NOT NULL
    AND length(trim(position)) > 0
  GROUP BY position
  ORDER BY position;
$$;
GRANT EXECUTE ON FUNCTION public.get_team_position_groups(uuid) TO authenticated;
