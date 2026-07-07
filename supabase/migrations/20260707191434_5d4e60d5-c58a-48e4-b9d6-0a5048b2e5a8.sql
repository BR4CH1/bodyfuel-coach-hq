-- Fix: profiles minor/guardian fields locked for self-update ----------------
CREATE OR REPLACE FUNCTION public.protect_profile_minor_fields_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  -- Coaches and any org-admin/staff (in ANY org) may update these fields.
  is_privileged :=
       public.has_role(auth.uid(), 'coach'::app_role)
    OR EXISTS (
         SELECT 1 FROM public.staff_assignments s
         WHERE s.user_id = auth.uid()
           AND s.role IN ('organization_admin','coach')
       );

  IF NOT is_privileged THEN
    NEW.is_minor := OLD.is_minor;
    NEW.requires_guardian_consent := OLD.requires_guardian_consent;
    NEW.guardian_name := OLD.guardian_name;
    NEW.guardian_email := OLD.guardian_email;
    -- birthdate drives is_minor derivation elsewhere; keep editable so users
    -- can correct data during onboarding. is_minor/consent fields stay locked.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_minor_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_minor_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_minor_fields_self_update();


-- Fix: team_memberships self-update cannot move to a different team/user ----
CREATE OR REPLACE FUNCTION public.protect_team_membership_self_update()
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
    OR EXISTS (
         SELECT 1 FROM public.organization_teams t
         WHERE t.id = OLD.team_id
           AND (
             public.is_org_admin(auth.uid(), t.organization_id)
             OR public.is_org_staff(auth.uid(), t.organization_id, 'manage_members')
           )
       );

  IF NOT is_privileged THEN
    -- Lock identifying/roster-authoritative columns to OLD values.
    NEW.team_id := OLD.team_id;
    NEW.user_id := OLD.user_id;
    -- Position/jersey/gym/days are set by the athlete's own onboarding form,
    -- so we intentionally allow self-edit there. Status is already gated by
    -- the RLS policy to pending/active.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_team_membership_self_update ON public.team_memberships;
CREATE TRIGGER trg_protect_team_membership_self_update
BEFORE UPDATE ON public.team_memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_team_membership_self_update();