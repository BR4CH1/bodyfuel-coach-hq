-- Restore the intended additive SGZ access after the two emergency migrations
-- from 2026-07-22/23 collapsed this account to one role at a time.
--
-- Source of truth:
--   organization_memberships = athlete access
--   staff_assignments         = coach/staff access
--   user_roles.role='coach'   = global BodyFuel coach (NOT an org coach)

DO $$
DECLARE
  target_user_id uuid := '3c05d81b-f4db-47e8-81be-053a07cb4f20';
  sgz_organization_id uuid;
BEGIN
  SELECT id
    INTO sgz_organization_id
    FROM public.organizations
   WHERE lower(slug) IN ('sgz', 'sgz-altenessen')
      OR lower(name) IN ('sgz altenessen', 'sgz-altenessen', 'sgz-altenessen e.v.')
   ORDER BY
     CASE
       WHEN lower(slug) = 'sgz-altenessen' THEN 0
       WHEN lower(slug) = 'sgz' THEN 1
       ELSE 2
     END
   LIMIT 1;

  IF sgz_organization_id IS NULL THEN
    RAISE NOTICE 'SGZ organization not found; dual-role repair skipped.';
    RETURN;
  END IF;

  -- An organization coach is not a global BodyFuel coach. Keeping this role
  -- out of user_roles prevents the global customer dashboard from opening.
  DELETE FROM public.user_roles
   WHERE user_id = target_user_id
     AND role = 'coach';

  -- Keep/create the athlete side of the dual role.
  ALTER TABLE public.organization_memberships DISABLE TRIGGER USER;

  INSERT INTO public.organization_memberships (
    user_id,
    organization_id,
    role,
    status,
    onboarding_completed
  )
  VALUES (
    target_user_id,
    sgz_organization_id,
    'athlete',
    'active',
    true
  )
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET
    role = 'athlete',
    status = 'active';

  ALTER TABLE public.organization_memberships ENABLE TRIGGER USER;

  -- Add the coach side independently. No global user_roles coach grant: this
  -- context may only open the SGZ-scoped coach dashboard and SGZ athletes.
  INSERT INTO public.staff_assignments (
    user_id,
    organization_id,
    team_id,
    role,
    permissions,
    function_label,
    onboarding_completed_at
  )
  VALUES (
    target_user_id,
    sgz_organization_id,
    NULL,
    'coach',
    ARRAY[
      'view_members',
      'manage_members',
      'view_training',
      'manage_training',
      'view_performance',
      'manage_performance',
      'view_checkins',
      'view_nutrition',
      'manage_challenges',
      'manage_ranking',
      'manage_community'
    ]::text[],
    'Coach',
    now()
  )
  ON CONFLICT (user_id, organization_id, team_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    function_label = COALESCE(
      public.staff_assignments.function_label,
      EXCLUDED.function_label
    ),
    onboarding_completed_at = COALESCE(
      public.staff_assignments.onboarding_completed_at,
      EXCLUDED.onboarding_completed_at
    );
END $$;
