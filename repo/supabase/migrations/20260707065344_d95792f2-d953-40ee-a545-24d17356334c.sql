
-- 1) meal_wishes: restrict partner updates to assignment columns only
CREATE OR REPLACE FUNCTION public.meal_wishes_restrict_partner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner and coaches: unrestricted (existing policies gate WHO can update)
  IF NEW.user_id = auth.uid() OR public.has_role(auth.uid(), 'coach'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Otherwise treat as partner update: only assignment fields may change
  IF NEW.wish IS DISTINCT FROM OLD.wish
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.coach_note IS DISTINCT FROM OLD.coach_note
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.consumed_at IS DISTINCT FROM OLD.consumed_at
     OR NEW.meal_slot IS DISTINCT FROM OLD.meal_slot
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Partners may only update assignment fields (applies_to, for_person) on meal wishes'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meal_wishes_restrict_partner_update_tr ON public.meal_wishes;
CREATE TRIGGER meal_wishes_restrict_partner_update_tr
  BEFORE UPDATE ON public.meal_wishes
  FOR EACH ROW EXECUTE FUNCTION public.meal_wishes_restrict_partner_update();

-- 2) organizations: remove anon public read; keep authenticated read
DROP POLICY IF EXISTS "orgs public read active" ON public.organizations;

-- 3) user_roles: defense-in-depth explicit deny for self-writes by non-coaches
--    (RLS is already default-deny; add a restrictive policy to make it explicit
--     and prevent any future permissive policy from accidentally enabling this.)
CREATE POLICY "user_roles restrict writes to coach only"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'coach'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coach'::public.app_role) AND role <> 'coach'::public.app_role);
