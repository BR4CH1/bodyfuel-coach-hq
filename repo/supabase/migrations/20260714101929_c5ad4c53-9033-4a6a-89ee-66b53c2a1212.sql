-- Fix: athlete_checkins_public_role_policy
-- Scope SELECT / DELETE / profile-read policies to 'authenticated' role
-- instead of 'public', so anonymous requests are denied by role scoping.

DROP POLICY IF EXISTS "athlete_checkins_coach_read" ON public.athlete_checkins;
CREATE POLICY "athlete_checkins_coach_read"
ON public.athlete_checkins
FOR SELECT
TO authenticated
USING (
  coach_can_access_user(auth.uid(), user_id)
  OR (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM staff_assignments s
      WHERE s.user_id = auth.uid()
        AND s.organization_id = athlete_checkins.organization_id
    )
  )
);

DROP POLICY IF EXISTS "progress_photos owner delete" ON public.progress_photos;
CREATE POLICY "progress_photos owner delete"
ON public.progress_photos
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR coach_can_access_user(auth.uid(), id));


-- Fix: food_alias_learning_public_read
-- Replace the blanket "read all authenticated" SELECT policy with an
-- owner-scoped read (owner + coach). The learning cache itself remains
-- usable through the security-definer server functions that write it.

DROP POLICY IF EXISTS "food_alias_learning read all authenticated" ON public.food_alias_learning;

CREATE POLICY "food_alias_learning read own"
ON public.food_alias_learning
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'coach'::app_role)
);


-- Fix: nutrition_foods_needs_review_visible
-- Provide a public-facing view that excludes internal review metadata
-- (verified_by, review_reason, needs_review) and revoke column-level
-- SELECT on those internal columns from `authenticated`. Coaches
-- continue to read the full table (including internal metadata) via
-- the has_role guard on the base policy, using the service-role
-- server functions that manage the review workflow.

CREATE OR REPLACE VIEW public.nutrition_foods_public
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  aliases,
  category,
  source,
  source_id,
  source_name,
  license,
  citation,
  kcal_per_100g,
  protein_per_100g,
  carbs_per_100g,
  fat_per_100g,
  fiber_per_100g,
  sugar_per_100g,
  salt_per_100g,
  unit_type,
  default_state,
  density_g_per_ml,
  verified_by_coach,
  verified_at,
  created_at,
  updated_at,
  text_id,
  is_active,
  safe_for_smart
FROM public.nutrition_foods;

GRANT SELECT ON public.nutrition_foods_public TO authenticated;
GRANT SELECT ON public.nutrition_foods_public TO anon;

-- Hide internal review-metadata columns from ordinary authenticated
-- reads. Service-role (server functions) retains full column access.
REVOKE SELECT (verified_by, review_reason) ON public.nutrition_foods FROM authenticated;
