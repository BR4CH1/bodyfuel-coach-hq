-- 1) daily_checks: ensure user-supplied points are always overwritten by trigger
DROP TRIGGER IF EXISTS trg_compute_daily_check_points ON public.daily_checks;
CREATE TRIGGER trg_compute_daily_check_points
BEFORE INSERT OR UPDATE ON public.daily_checks
FOR EACH ROW EXECUTE FUNCTION public.compute_daily_check_points();

-- 2) organization_challenge_progress: prevent self-fabrication of points
CREATE OR REPLACE FUNCTION public.protect_challenge_progress_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org uuid;
  v_is_staff boolean := false;
BEGIN
  -- service_role / no auth context: allow
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up the challenge's organization to check staff/admin
  SELECT organization_id INTO v_org
  FROM public.organization_challenges
  WHERE id = NEW.challenge_id;

  IF v_org IS NOT NULL THEN
    v_is_staff := public.is_org_admin(v_caller, v_org)
                  OR public.is_org_staff(v_caller, v_org, 'manage_challenges')
                  OR public.has_role(v_caller, 'coach'::public.app_role);
  END IF;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Non-staff self-write: force points to server-controlled value
  IF TG_OP = 'INSERT' THEN
    NEW.points := 0;
  ELSE
    NEW.points := OLD.points;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_challenge_progress_points ON public.organization_challenge_progress;
CREATE TRIGGER trg_protect_challenge_progress_points
BEFORE INSERT OR UPDATE ON public.organization_challenge_progress
FOR EACH ROW EXECUTE FUNCTION public.protect_challenge_progress_points();

-- 3) is_org_staff: remove NULL-permission bypass; NULL now requires an admin/coach role
CREATE OR REPLACE FUNCTION public.is_org_staff(_user uuid, _org uuid, _permission text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_assignments s
    WHERE s.user_id = _user
      AND s.organization_id = _org
      AND (
        s.role IN ('organization_admin','coach')
        OR (_permission IS NOT NULL AND _permission = ANY(s.permissions))
      )
  );
$$;