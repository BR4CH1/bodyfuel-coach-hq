
-- Kursleiter-Freischaltung pro Organisation, pro Mitglied.
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS is_course_instructor boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_org_memberships_course_instructor
  ON public.organization_memberships (user_id)
  WHERE is_course_instructor = true;

-- Nicht mehr benötigtes Organisations-Modul entfernen (falls je aktiviert).
DELETE FROM public.organization_features WHERE feature = 'coach_tools';
