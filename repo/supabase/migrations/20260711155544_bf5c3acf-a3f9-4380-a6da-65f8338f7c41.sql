-- Platform owner has legitimate global read access to profiles.
-- Restore this while keeping regular coaches scoped via customer_packages / staff_assignments.

CREATE OR REPLACE FUNCTION public.coach_can_access_user(_coach_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _coach_id = _target_user_id
    OR public.has_role(_coach_id, 'platform_owner'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.customer_packages cp
      WHERE cp.user_id = _target_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.staff_assignments sa_coach
      JOIN public.organization_memberships om
        ON om.organization_id = sa_coach.organization_id
      WHERE sa_coach.user_id = _coach_id
        AND sa_coach.role IN ('organization_admin', 'coach')
        AND om.user_id = _target_user_id
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_org_member_profile(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    public.has_role(_viewer, 'platform_owner'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.staff_assignments sa
      WHERE sa.user_id = _viewer
        AND sa.role IN ('organization_admin', 'coach')
        AND (
          EXISTS (
            SELECT 1 FROM public.organization_memberships om
            WHERE om.user_id = _target
              AND om.organization_id = sa.organization_id
              AND (om.status IS NULL OR om.status = 'active')
          )
          OR EXISTS (
            SELECT 1 FROM public.staff_assignments sa2
            WHERE sa2.user_id = _target
              AND sa2.organization_id = sa.organization_id
          )
        )
    );
$function$;