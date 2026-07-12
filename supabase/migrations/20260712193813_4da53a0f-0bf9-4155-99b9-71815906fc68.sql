
DROP POLICY IF EXISTS "staff manage admin" ON public.staff_assignments;
CREATE POLICY "staff manage admin"
ON public.staff_assignments
AS PERMISSIVE
FOR ALL
TO authenticated
USING (is_org_admin(auth.uid(), organization_id))
WITH CHECK (is_org_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "bulls_events_staff_select" ON public.bulls_ranking_events;
CREATE POLICY "bulls_events_staff_select"
ON public.bulls_ranking_events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  is_org_staff(auth.uid(), organization_id, 'view_performance'::text)
  OR is_org_staff(auth.uid(), organization_id, 'manage_performance'::text)
);

DROP POLICY IF EXISTS "sc_owner_select" ON public.strength_checks;
CREATE POLICY "sc_owner_select"
ON public.strength_checks
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR coach_can_access_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "ts coach read" ON public.training_sessions;
CREATE POLICY "ts coach read"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (coach_can_access_user(auth.uid(), client_id));

DROP POLICY IF EXISTS "progress_photos owner read" ON public.progress_photos;
CREATE POLICY "progress_photos owner read"
ON public.progress_photos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own measurements read" ON public.body_measurements;
CREATE POLICY "own measurements read"
ON public.body_measurements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own checkins read" ON public.weekly_checkins;
CREATE POLICY "own checkins read"
ON public.weekly_checkins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own checkins update" ON public.weekly_checkins;
CREATE POLICY "own checkins update"
ON public.weekly_checkins
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users manage own food" ON public.food_entries;
CREATE POLICY "users manage own food"
ON public.food_entries
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user reads own payments" ON public.payment_history;
CREATE POLICY "user reads own payments"
ON public.payment_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "coach updates payment" ON public.payment_history;
CREATE POLICY "coach updates payment"
ON public.payment_history
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'coach'::app_role))
WITH CHECK (has_role(auth.uid(), 'coach'::app_role));
