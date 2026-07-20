-- Ensure no duplicate rows before creating unique index (defensive dedupe: keep most recent)
DELETE FROM public.staff_assignments a
USING public.staff_assignments b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.organization_id = b.organization_id
  AND a.team_id IS NOT DISTINCT FROM b.team_id;

-- Unique index treating NULL team_id (org-weite Zuweisung) as equal, damit ON CONFLICT (user_id, organization_id, team_id) funktioniert
CREATE UNIQUE INDEX IF NOT EXISTS staff_assignments_user_org_team_uniq
  ON public.staff_assignments (user_id, organization_id, team_id)
  NULLS NOT DISTINCT;