
-- 1) Team training schedule
CREATE TABLE public.organization_team_training_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.organization_teams(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NULL,
  end_time time NULL,
  title text NOT NULL DEFAULT 'Team Training',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_team_training_schedule TO authenticated;
GRANT ALL ON public.organization_team_training_schedule TO service_role;

ALTER TABLE public.organization_team_training_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_schedule_read_members"
ON public.organization_team_training_schedule FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    JOIN public.organization_memberships om ON om.organization_id = t.organization_id
    WHERE t.id = organization_team_training_schedule.team_id AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_teams t
    JOIN public.staff_assignments sa ON sa.organization_id = t.organization_id
    WHERE t.id = organization_team_training_schedule.team_id AND sa.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'coach')
);

CREATE POLICY "team_schedule_write_staff"
ON public.organization_team_training_schedule FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    JOIN public.staff_assignments sa ON sa.organization_id = t.organization_id
    WHERE t.id = organization_team_training_schedule.team_id AND sa.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'coach')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_teams t
    JOIN public.staff_assignments sa ON sa.organization_id = t.organization_id
    WHERE t.id = organization_team_training_schedule.team_id AND sa.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'coach')
);

CREATE TRIGGER trg_org_team_training_schedule_updated
BEFORE UPDATE ON public.organization_team_training_schedule
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) organization_tasks: source tracking + explicit scheduled_date for idempotency
ALTER TABLE public.organization_tasks
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS points integer,
  ADD COLUMN IF NOT EXISTS scheduled_date date;

-- Backfill scheduled_date from scheduled_for (UTC date) for existing rows
UPDATE public.organization_tasks
   SET scheduled_date = (scheduled_for AT TIME ZONE 'UTC')::date
 WHERE scheduled_date IS NULL AND scheduled_for IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_tasks_source_day
ON public.organization_tasks (
  organization_id, user_id, task_type, source_type, source_id, scheduled_date
)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND scheduled_date IS NOT NULL;
