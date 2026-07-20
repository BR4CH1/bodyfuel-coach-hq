
CREATE OR REPLACE FUNCTION public.coach_can_access_user(_coach_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _coach_id IS NOT NULL
    AND _target_user_id IS NOT NULL
    AND public.has_role(_coach_id, 'coach'::public.app_role)
    AND (
      EXISTS (
        SELECT 1 FROM public.customer_packages cp
        WHERE cp.user_id = _target_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.staff_assignments s
        JOIN public.organization_memberships m
          ON m.organization_id = s.organization_id
        WHERE s.user_id = _coach_id
          AND m.user_id = _target_user_id
          AND (m.status = 'active' OR m.status IS NULL)
      )
      OR _coach_id = _target_user_id
    );
$$;
