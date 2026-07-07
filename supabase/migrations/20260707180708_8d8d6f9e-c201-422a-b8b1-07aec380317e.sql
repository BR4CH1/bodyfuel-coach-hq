-- Coach Notizen zu Athleten (privat innerhalb der Organisation)
CREATE TABLE IF NOT EXISTS public.coach_athlete_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  athlete_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_notes_org_athlete
  ON public.coach_athlete_notes(organization_id, athlete_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_athlete_notes TO authenticated;
GRANT ALL ON public.coach_athlete_notes TO service_role;

ALTER TABLE public.coach_athlete_notes ENABLE ROW LEVEL SECURITY;

-- Lesen: eigenes bodyfuel-coach oder Org-Staff/Admin der Organisation
CREATE POLICY "coach_notes_select"
ON public.coach_athlete_notes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coach')
  OR public.is_org_admin(auth.uid(), organization_id)
  OR EXISTS (
    SELECT 1 FROM public.staff_assignments s
    WHERE s.user_id = auth.uid() AND s.organization_id = coach_athlete_notes.organization_id
  )
);

-- Einfügen: nur als Autor, mit Coach/Staff/Admin-Berechtigung in der Org
CREATE POLICY "coach_notes_insert"
ON public.coach_athlete_notes FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'coach')
    OR public.is_org_admin(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid() AND s.organization_id = coach_athlete_notes.organization_id
    )
  )
);

-- Update/Delete: nur eigene Notiz
CREATE POLICY "coach_notes_update_own"
ON public.coach_athlete_notes FOR UPDATE
TO authenticated
USING (author_user_id = auth.uid())
WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "coach_notes_delete_own"
ON public.coach_athlete_notes FOR DELETE
TO authenticated
USING (author_user_id = auth.uid());

CREATE TRIGGER trg_coach_athlete_notes_updated_at
BEFORE UPDATE ON public.coach_athlete_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();