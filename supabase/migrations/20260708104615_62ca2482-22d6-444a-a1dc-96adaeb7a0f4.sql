
CREATE TABLE public.org_team_training_week (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_team_training_week_status_check CHECK (status IN ('draft','published')),
  CONSTRAINT org_team_training_week_monday_check CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  UNIQUE (team_id, week_start)
);
CREATE INDEX idx_org_team_training_week_org ON public.org_team_training_week (organization_id, team_id, week_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_team_training_week TO authenticated;
GRANT ALL ON public.org_team_training_week TO service_role;

ALTER TABLE public.org_team_training_week ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_team_training_week_read" ON public.org_team_training_week
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id = org_team_training_week.team_id AND tm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.organization_id = org_team_training_week.organization_id AND sa.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = org_team_training_week.organization_id AND om.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'coach')
  );

CREATE POLICY "org_team_training_week_write_staff" ON public.org_team_training_week
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.organization_id = org_team_training_week.organization_id AND sa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coach')
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.organization_id = org_team_training_week.organization_id AND sa.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_org_team_training_week_updated_at
  BEFORE UPDATE ON public.org_team_training_week
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.org_team_training_week_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.org_team_training_week(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  title text NOT NULL DEFAULT 'Team Training',
  description text,
  start_time time,
  end_time time,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, session_date)
);
CREATE INDEX idx_org_team_training_week_session_date ON public.org_team_training_week_session (session_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_team_training_week_session TO authenticated;
GRANT ALL ON public.org_team_training_week_session TO service_role;

ALTER TABLE public.org_team_training_week_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_team_training_week_session_read" ON public.org_team_training_week_session
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_team_training_week w
      WHERE w.id = org_team_training_week_session.week_id
        AND (
          EXISTS (
            SELECT 1 FROM public.team_memberships tm
            WHERE tm.team_id = w.team_id AND tm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.staff_assignments sa
            WHERE sa.organization_id = w.organization_id AND sa.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.organization_memberships om
            WHERE om.organization_id = w.organization_id AND om.user_id = auth.uid()
          )
          OR public.has_role(auth.uid(), 'coach')
        )
    )
  );

CREATE POLICY "org_team_training_week_session_write_staff" ON public.org_team_training_week_session
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_team_training_week w
      WHERE w.id = org_team_training_week_session.week_id
        AND (
          public.has_role(auth.uid(), 'coach')
          OR EXISTS (
            SELECT 1 FROM public.staff_assignments sa
            WHERE sa.organization_id = w.organization_id AND sa.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_team_training_week w
      WHERE w.id = org_team_training_week_session.week_id
        AND (
          public.has_role(auth.uid(), 'coach')
          OR EXISTS (
            SELECT 1 FROM public.staff_assignments sa
            WHERE sa.organization_id = w.organization_id AND sa.user_id = auth.uid()
          )
        )
    )
  );

CREATE TRIGGER trg_org_team_training_week_session_updated_at
  BEFORE UPDATE ON public.org_team_training_week_session
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.assert_session_within_week()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws date;
BEGIN
  SELECT week_start INTO ws FROM public.org_team_training_week WHERE id = NEW.week_id;
  IF ws IS NULL THEN
    RAISE EXCEPTION 'Unknown week_id %', NEW.week_id;
  END IF;
  IF NEW.session_date < ws OR NEW.session_date > ws + 6 THEN
    RAISE EXCEPTION 'session_date % outside week range % .. %', NEW.session_date, ws, ws + 6;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_team_training_week_session_within_week
  BEFORE INSERT OR UPDATE ON public.org_team_training_week_session
  FOR EACH ROW EXECUTE FUNCTION public.assert_session_within_week();
