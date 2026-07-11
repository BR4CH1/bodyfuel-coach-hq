CREATE OR REPLACE FUNCTION public.coach_can_access_user(_coach_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _coach_id = _target_user_id
    OR public.has_role(_coach_id, 'platform_owner'::public.app_role)
    OR (
      public.has_role(_coach_id, 'coach'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.customer_packages cp
        WHERE cp.user_id = _target_user_id
      )
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