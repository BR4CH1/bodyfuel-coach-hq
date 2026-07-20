-- 1) mode column for autopilot jobs
ALTER TABLE public.smart_autopilot_jobs
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'full';

ALTER TABLE public.smart_autopilot_jobs
  DROP CONSTRAINT IF EXISTS smart_autopilot_jobs_mode_check;
ALTER TABLE public.smart_autopilot_jobs
  ADD CONSTRAINT smart_autopilot_jobs_mode_check
  CHECK (mode IN ('full','nutrition_only'));

-- 2) Fix privilege-escalation via self-update of organization_memberships.
--    Replace tautological WITH CHECK with a BEFORE UPDATE trigger that
--    resets protected fields to their OLD values when the caller is not
--    a coach/org admin/staff with manage_members.

CREATE OR REPLACE FUNCTION public.protect_org_membership_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged :=
       public.has_role(auth.uid(), 'coach'::app_role)
    OR public.is_org_admin(auth.uid(), OLD.organization_id)
    OR public.is_org_staff(auth.uid(), OLD.organization_id, 'manage_members');

  IF NOT is_privileged THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.organization_id := OLD.organization_id;
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_org_membership_self_update ON public.organization_memberships;
CREATE TRIGGER trg_protect_org_membership_self_update
BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_org_membership_self_update();

-- Simplify self-update policy: user can update their own row; the trigger
-- guarantees protected fields cannot be escalated.
DROP POLICY IF EXISTS "org memberships update own onboarding" ON public.organization_memberships;
CREATE POLICY "org memberships update own onboarding"
ON public.organization_memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());