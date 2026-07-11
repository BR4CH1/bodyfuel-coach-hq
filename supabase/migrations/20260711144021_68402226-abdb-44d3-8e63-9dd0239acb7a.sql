
-- Helper: does the calling coach have a legitimate relationship with target user?
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
      -- Target is a personal BodyFuel customer
      EXISTS (
        SELECT 1 FROM public.customer_packages cp
        WHERE cp.user_id = _target_user_id AND cp.is_active = true
      )
      -- Or coach shares an organization with target via staff_assignments
      OR EXISTS (
        SELECT 1
        FROM public.staff_assignments s
        JOIN public.organization_memberships m
          ON m.organization_id = s.organization_id
        WHERE s.user_id = _coach_id
          AND m.user_id = _target_user_id
          AND (m.status = 'active' OR m.status IS NULL)
      )
      -- Or target is the coach themselves
      OR _coach_id = _target_user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.coach_can_access_user(uuid, uuid) TO authenticated, service_role;

-- profiles: scope coach access
DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.coach_can_access_user(auth.uid(), id));

-- user_roles: remove coach self-grant path
DROP POLICY IF EXISTS "Coach manages non-privileged roles" ON public.user_roles;
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_owner'::public.app_role));

-- payment_history
DROP POLICY IF EXISTS "user reads own payments" ON public.payment_history;
DROP POLICY IF EXISTS "coach updates payment" ON public.payment_history;
DROP POLICY IF EXISTS "coach deletes payment" ON public.payment_history;
CREATE POLICY "user reads own payments"
  ON public.payment_history FOR SELECT
  USING (user_id = auth.uid() OR public.coach_can_access_user(auth.uid(), user_id));
CREATE POLICY "coach updates payment"
  ON public.payment_history FOR UPDATE
  USING (public.coach_can_access_user(auth.uid(), user_id));
CREATE POLICY "coach deletes payment"
  ON public.payment_history FOR DELETE
  USING (public.coach_can_access_user(auth.uid(), user_id));

-- subscriptions
DROP POLICY IF EXISTS "Coaches can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Coaches can view subscriptions of their clients"
  ON public.subscriptions FOR SELECT
  USING (public.coach_can_access_user(auth.uid(), user_id));

-- athlete_checkins
DROP POLICY IF EXISTS "athlete_checkins_coach_read" ON public.athlete_checkins;
CREATE POLICY "athlete_checkins_coach_read"
  ON public.athlete_checkins FOR SELECT
  USING (
    public.coach_can_access_user(auth.uid(), user_id)
    OR (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid() AND s.organization_id = athlete_checkins.organization_id
    ))
  );

-- body_measurements
DROP POLICY IF EXISTS "own measurements read" ON public.body_measurements;
CREATE POLICY "own measurements read"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id));

-- food_entries
DROP POLICY IF EXISTS "users manage own food" ON public.food_entries;
CREATE POLICY "users manage own food"
  ON public.food_entries FOR ALL
  USING (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id));

-- training_sessions
DROP POLICY IF EXISTS "ts coach read" ON public.training_sessions;
CREATE POLICY "ts coach read"
  ON public.training_sessions FOR SELECT
  USING (public.coach_can_access_user(auth.uid(), client_id));

-- strength_checks
DROP POLICY IF EXISTS "sc_owner_select" ON public.strength_checks;
CREATE POLICY "sc_owner_select"
  ON public.strength_checks FOR SELECT
  USING (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id));

-- weekly_checkins
DROP POLICY IF EXISTS "own checkins read" ON public.weekly_checkins;
DROP POLICY IF EXISTS "own checkins update" ON public.weekly_checkins;
CREATE POLICY "own checkins read"
  ON public.weekly_checkins FOR SELECT
  USING (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id));
CREATE POLICY "own checkins update"
  ON public.weekly_checkins FOR UPDATE
  USING (auth.uid() = user_id OR public.coach_can_access_user(auth.uid(), user_id));

-- progress_photos
DROP POLICY IF EXISTS "progress_photos owner read" ON public.progress_photos;
DROP POLICY IF EXISTS "progress_photos owner delete" ON public.progress_photos;
CREATE POLICY "progress_photos owner read"
  ON public.progress_photos FOR SELECT
  USING (user_id = auth.uid() OR public.coach_can_access_user(auth.uid(), user_id));
CREATE POLICY "progress_photos owner delete"
  ON public.progress_photos FOR DELETE
  USING (user_id = auth.uid() OR public.coach_can_access_user(auth.uid(), user_id));
