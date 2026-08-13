-- Keep coach dashboard access scoped to customers who are current today.
CREATE OR REPLACE FUNCTION public.coach_can_access_current_user(
  _coach_id uuid,
  _target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _coach_id = _target_user_id
    OR public.has_role(_coach_id, 'platform_owner'::public.app_role)
    OR (
      public.has_role(_coach_id, 'coach'::public.app_role)
      AND EXISTS (
        SELECT 1
        FROM public.customer_packages cp
        WHERE cp.user_id = _target_user_id
          AND cp.is_active IS TRUE
          AND lower(COALESCE(cp.status, 'active')) NOT IN (
            'canceled', 'cancelled', 'expired', 'inactive'
          )
          AND (cp.end_date IS NULL OR cp.end_date >= CURRENT_DATE)
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

REVOKE ALL ON FUNCTION public.coach_can_access_current_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_can_access_current_user(uuid, uuid)
  TO authenticated, service_role;

-- Submitted check-ins must be readable and reviewable by the current coach.
DROP POLICY IF EXISTS "coach read current checkins" ON public.weekly_checkins;
CREATE POLICY "coach read current checkins"
ON public.weekly_checkins
FOR SELECT
TO authenticated
USING (public.coach_can_access_current_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "coach update current checkins" ON public.weekly_checkins;
CREATE POLICY "coach update current checkins"
ON public.weekly_checkins
FOR UPDATE
TO authenticated
USING (public.coach_can_access_current_user(auth.uid(), user_id))
WITH CHECK (public.coach_can_access_current_user(auth.uid(), user_id));

-- Replace broad coach reads with current-customer reads.
DROP POLICY IF EXISTS "coach read all measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "coach read current measurements" ON public.body_measurements;
CREATE POLICY "coach read current measurements"
ON public.body_measurements
FOR SELECT
TO authenticated
USING (public.coach_can_access_current_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "coach read all food" ON public.food_entries;
DROP POLICY IF EXISTS "coach read current food" ON public.food_entries;
CREATE POLICY "coach read current food"
ON public.food_entries
FOR SELECT
TO authenticated
USING (public.coach_can_access_current_user(auth.uid(), user_id));

-- Training logs previously allowed every coach to read and mutate every client.
DROP POLICY IF EXISTS "log read own or coach" ON public.training_set_logs;
DROP POLICY IF EXISTS "log read own or current coach" ON public.training_set_logs;
CREATE POLICY "log read own or current coach"
ON public.training_set_logs
FOR SELECT
TO authenticated
USING (
  client_id = auth.uid()
  OR public.coach_can_access_current_user(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "log insert own" ON public.training_set_logs;
DROP POLICY IF EXISTS "log insert own or current coach" ON public.training_set_logs;
CREATE POLICY "log insert own or current coach"
ON public.training_set_logs
FOR INSERT
TO authenticated
WITH CHECK (
  client_id = auth.uid()
  OR public.coach_can_access_current_user(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "log update own or coach" ON public.training_set_logs;
DROP POLICY IF EXISTS "log update own or current coach" ON public.training_set_logs;
CREATE POLICY "log update own or current coach"
ON public.training_set_logs
FOR UPDATE
TO authenticated
USING (
  client_id = auth.uid()
  OR public.coach_can_access_current_user(auth.uid(), client_id)
)
WITH CHECK (
  client_id = auth.uid()
  OR public.coach_can_access_current_user(auth.uid(), client_id)
);

DROP POLICY IF EXISTS "log delete own or coach" ON public.training_set_logs;
DROP POLICY IF EXISTS "log delete own or current coach" ON public.training_set_logs;
CREATE POLICY "log delete own or current coach"
ON public.training_set_logs
FOR DELETE
TO authenticated
USING (
  client_id = auth.uid()
  OR public.coach_can_access_current_user(auth.uid(), client_id)
);

-- Fetch one latest nutrition and training activity per requested customer.
-- SECURITY INVOKER deliberately keeps RLS in force.
CREATE OR REPLACE FUNCTION public.coach_latest_client_activity(_client_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  last_nutrition_at timestamptz,
  last_nutrition_name text,
  last_training_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT
    requested.user_id,
    food.created_at AS last_nutrition_at,
    food.name::text AS last_nutrition_name,
    training.performed_at AS last_training_at
  FROM unnest(COALESCE(_client_ids, ARRAY[]::uuid[])) AS requested(user_id)
  LEFT JOIN LATERAL (
    SELECT entry.created_at, entry.name
    FROM public.food_entries entry
    WHERE entry.user_id = requested.user_id
    ORDER BY entry.created_at DESC
    LIMIT 1
  ) food ON TRUE
  LEFT JOIN LATERAL (
    SELECT log.performed_at
    FROM public.training_set_logs log
    WHERE log.client_id = requested.user_id
    ORDER BY log.performed_at DESC
    LIMIT 1
  ) training ON TRUE;
$function$;

REVOKE ALL ON FUNCTION public.coach_latest_client_activity(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_latest_client_activity(uuid[])
  TO authenticated, service_role;
