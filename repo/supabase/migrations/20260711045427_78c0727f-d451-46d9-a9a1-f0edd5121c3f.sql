-- 1) Security: restrict organization management to platform_owner (remove overprivileged coach-ALL policy)
DROP POLICY IF EXISTS "orgs super admin manage" ON public.organizations;

CREATE POLICY "Platform owners can delete organizations"
ON public.organizations FOR DELETE
USING (public.has_role(auth.uid(), 'platform_owner'::app_role));

-- 2) Backfill: award Bulls nutrition points for existing food_entries that predate the trigger.
DO $$
DECLARE
  _bulls_org uuid := 'b86f49ab-20b7-42ca-bba4-f65ca8757c4c';
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT fe.user_id, fe.entry_date
    FROM public.food_entries fe
    JOIN public.organization_memberships om
      ON om.user_id = fe.user_id
     AND om.organization_id = _bulls_org
  LOOP
    PERFORM public.recompute_bulls_nutrition_day(r.user_id, _bulls_org, r.entry_date);
  END LOOP;

  -- Recompute streak once per bulls member at the end
  FOR r IN
    SELECT DISTINCT om.user_id
    FROM public.organization_memberships om
    WHERE om.organization_id = _bulls_org
  LOOP
    PERFORM public.recompute_bulls_streak(r.user_id, _bulls_org);
  END LOOP;
END$$;