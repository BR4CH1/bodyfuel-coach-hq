-- 1) coach_athlete_notes: restrict to admins/coaches or manage_athletes permission
DROP POLICY IF EXISTS coach_notes_select ON public.coach_athlete_notes;
DROP POLICY IF EXISTS coach_notes_insert ON public.coach_athlete_notes;

CREATE POLICY coach_notes_select ON public.coach_athlete_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'coach'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
    OR is_org_staff(auth.uid(), organization_id, 'manage_athletes')
  );

CREATE POLICY coach_notes_insert ON public.coach_athlete_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (
      has_role(auth.uid(), 'coach'::app_role)
      OR is_org_admin(auth.uid(), organization_id)
      OR is_org_staff(auth.uid(), organization_id, 'manage_athletes')
    )
  );

-- 2) leads: harden public insert path with strict length caps to limit PII abuse
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_name_len_chk,
  DROP CONSTRAINT IF EXISTS leads_phone_len_chk,
  DROP CONSTRAINT IF EXISTS leads_message_len_chk,
  DROP CONSTRAINT IF EXISTS leads_city_len_chk,
  DROP CONSTRAINT IF EXISTS leads_notes_len_chk,
  DROP CONSTRAINT IF EXISTS leads_goal_len_chk;

DO $$
DECLARE
  col text;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leads'
  LOOP
    IF col = 'name'    THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_name_len_chk    CHECK (name IS NULL OR length(name) <= 120)'; END IF;
    IF col = 'phone'   THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_phone_len_chk   CHECK (phone IS NULL OR length(phone) <= 40)'; END IF;
    IF col = 'message' THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_message_len_chk CHECK (message IS NULL OR length(message) <= 2000)'; END IF;
    IF col = 'city'    THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_city_len_chk    CHECK (city IS NULL OR length(city) <= 120)'; END IF;
    IF col = 'notes'   THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_notes_len_chk   CHECK (notes IS NULL OR length(notes) <= 2000)'; END IF;
    IF col = 'goal'    THEN EXECUTE 'ALTER TABLE public.leads ADD CONSTRAINT leads_goal_len_chk    CHECK (goal IS NULL OR length(goal) <= 500)'; END IF;
  END LOOP;
END $$;

-- 3) organization_memberships: only true admins (org_admin or platform coach)
--    may grant/change admin/coach roles. Staff with only 'manage_members'
--    can still manage regular member rows but cannot elevate to admin/coach.
DROP POLICY IF EXISTS "memberships only admins grant admin_coach on insert" ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships only admins grant admin_coach on update" ON public.organization_memberships;

CREATE POLICY "memberships only admins grant admin_coach on insert"
  ON public.organization_memberships
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
    OR has_role(auth.uid(), 'coach'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
  );

CREATE POLICY "memberships only admins grant admin_coach on update"
  ON public.organization_memberships
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
    OR has_role(auth.uid(), 'coach'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
  )
  WITH CHECK (
    role <> ALL (ARRAY['organization_admin'::organization_role, 'coach'::organization_role])
    OR has_role(auth.uid(), 'coach'::app_role)
    OR is_org_admin(auth.uid(), organization_id)
  );