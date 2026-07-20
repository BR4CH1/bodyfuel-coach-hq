
-- Athleten-Prefill für organization_invites (Position/Trikotnummer beim Einladen)
ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS athlete_primary_position TEXT,
  ADD COLUMN IF NOT EXISTS athlete_secondary_position TEXT,
  ADD COLUMN IF NOT EXISTS athlete_jersey_number INT;

-- Manuell angelegte Athleten ohne Auth-Account (Pending Roster Entries).
-- Sobald der Athlet über eine spätere Einladung tatsächlich einen Account
-- aktiviert, wird der Eintrag entweder verknüpft (linked_user_id) oder gelöscht.
CREATE TABLE IF NOT EXISTS public.roster_pending_athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.organization_teams(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  height_cm INT,
  weight_kg NUMERIC(5,2),
  primary_position TEXT,
  secondary_position TEXT,
  jersey_number INT,
  note TEXT,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roster_pending_athletes TO authenticated;
GRANT ALL ON public.roster_pending_athletes TO service_role;

ALTER TABLE public.roster_pending_athletes ENABLE ROW LEVEL SECURITY;

-- Nur Vereinsleitung/Head-Coach der Organisation dürfen Roster-Einträge sehen
-- und verändern. Team-Coaches erhalten Zugriff nur, wenn sie explizit die
-- Permission 'invite_athletes' in staff_assignments.permissions haben und der
-- Eintrag zu einem ihrer zugewiesenen Teams gehört. Der eigentliche
-- Team-Scope-Check läuft serverseitig — hier sichern wir org-weiten Lesezugriff
-- für erlaubte Rollen ab, damit die Übersichtsliste funktioniert.
CREATE POLICY "roster pending: org staff read"
ON public.roster_pending_athletes
FOR SELECT TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid()
      AND sa.organization_id = roster_pending_athletes.organization_id
      AND sa.role = 'coach'
  )
);

CREATE POLICY "roster pending: org staff write"
ON public.roster_pending_athletes
FOR ALL TO authenticated
USING (
  public.is_org_admin(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid()
      AND sa.organization_id = roster_pending_athletes.organization_id
      AND sa.role = 'coach'
      AND ('manage_organization' = ANY(sa.permissions) OR 'invite_athletes' = ANY(sa.permissions))
  )
)
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments sa
    WHERE sa.user_id = auth.uid()
      AND sa.organization_id = roster_pending_athletes.organization_id
      AND sa.role = 'coach'
      AND ('manage_organization' = ANY(sa.permissions) OR 'invite_athletes' = ANY(sa.permissions))
  )
);

CREATE INDEX IF NOT EXISTS idx_roster_pending_org ON public.roster_pending_athletes(organization_id);
CREATE INDEX IF NOT EXISTS idx_roster_pending_team ON public.roster_pending_athletes(team_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_roster_pending_updated ON public.roster_pending_athletes;
CREATE TRIGGER trg_roster_pending_updated
BEFORE UPDATE ON public.roster_pending_athletes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
